using System.Globalization;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public class PhotoImportService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    IPhotoFolderRepository folderRepository,
    IPhotoCopyRepository copyRepository,
    IFileStorage fileStorage,
    IPhotoPreviewGenerator previewGenerator,
    IPhotoImportQueue queue,
    IAuditService auditService,
    IUnitOfWork unitOfWork,
    PhotoGalleryOptions options,
    IStudioPhotoRootService photoRoots,
    ILogger<PhotoImportService> logger) : IPhotoImportService
{
    private const string Module = "PhotoSelection";
    private const int BatchSize = 24;


    // ---- Folder browsing -------------------------------------------------------------------

    // Only ever inside the studio's own photo root: an empty path opens the root itself.
    public async Task<(PhotoPathProblem Problem, FolderBrowseResultDto? Result)> BrowseFoldersAsync(int studioId, string? path, CancellationToken ct = default)
    {
        var root = await photoRoots.GetRootAsync(studioId, ct);
        if (root is null)
        {
            return (PhotoPathProblem.NoRoot, null);
        }

        var problem = StudioPhotoRootService.Check(root, string.IsNullOrWhiteSpace(path) ? root : path, out var full);
        if (problem != PhotoPathProblem.None)
        {
            return (problem, null);
        }

        try
        {
            var folders = Directory.EnumerateDirectories(full, "*", StudioPhotoRootService.SafeEnumeration(recurse: false))
                .Select(p => new FolderBrowseEntryDto { Name = Path.GetFileName(p), FullPath = p })
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            // "Up" stops at the studio's root.
            var parent = StudioPhotoRootService.Check(root, Directory.GetParent(full)?.FullName, out var parentFull) == PhotoPathProblem.None
                ? parentFull : null;

            return (PhotoPathProblem.None, new FolderBrowseResultDto
            {
                CurrentPath = full,
                ParentPath = parent,
                RootPath = root,
                Folders = folders,
                ImageCount = EnumerateImages(full).Count()
            });
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException)
        {
            return (PhotoPathProblem.NotFound, null);
        }
    }

    // Maps a photo's path relative to the source folder to the delivery folder it belongs in:
    // "Candid Photos\IMG_1.jpg" -> the "Candid Photos" folder, "IMG_1.jpg" -> unfiled.
    private static string? FolderNameFor(string relativePath)
    {
        var segments = relativePath.Split(['\\', '/'], StringSplitOptions.RemoveEmptyEntries);
        return segments.Length < 2 ? null : segments[0];
    }

    private static int? FolderIdFor(string relativePath, IReadOnlyDictionary<string, int> folders)
    {
        var name = FolderNameFor(relativePath);
        return name is not null && folders.TryGetValue(name, out var id) ? id : null;
    }

    // Creates any delivery folder this batch of files needs, and returns them all by name.
    private async Task<Dictionary<string, int>> EnsureFoldersAsync(PhotoImportJob job, IEnumerable<string> relativePaths, CancellationToken ct)
    {
        var gallery = await galleryRepository.GetByIdUnscopedAsync(job.PhotoGalleryId, ct);
        var existing = await folderRepository.GetByGalleryAsync(job.PhotoGalleryId, ct);
        var byName = existing.ToDictionary(f => f.Name, f => f.PhotoFolderId, StringComparer.OrdinalIgnoreCase);
        if (gallery is null)
        {
            return byName;
        }

        var needed = relativePaths.Select(FolderNameFor).OfType<string>().Distinct(StringComparer.OrdinalIgnoreCase);
        var sort = existing.Count == 0 ? 0 : existing.Max(f => f.SortOrder);
        var now = DateTime.UtcNow;
        var added = false;

        foreach (var name in needed)
        {
            if (byName.ContainsKey(name))
            {
                continue;
            }

            var folder = new PhotoFolder
            {
                StudioId = gallery.StudioId,
                PhotoGalleryId = job.PhotoGalleryId,
                Name = name,
                SortOrder = ++sort,
                CreatedAt = now,
                UpdatedAt = now
            };
            await folderRepository.AddAsync(folder, ct);
            added = true;
        }

        if (added)
        {
            await unitOfWork.SaveChangesAsync(ct);
            foreach (var folder in await folderRepository.GetByGalleryAsync(job.PhotoGalleryId, ct))
            {
                byName[folder.Name] = folder.PhotoFolderId;
            }
        }

        return byName;
    }

    private static IEnumerable<string> EnumerateImages(string folder) => ScanFolder(folder).Photos;

    // Sorts a folder's files into photos to import (JPEG and camera RAW) and everything skipped.
    // A RAW file with a JPEG of the same name beside it (cameras shooting RAW+JPEG) is the same
    // photo twice, so only the JPEG is imported.
    private static (List<string> Photos, SkippedFilesDto Skipped) ScanFolder(string folder)
    {
        var skipped = new SkippedFilesDto();
        // Junctions/symlinks inside the folder are never followed (they could lead outside the studio's root).
        var files = Directory.EnumerateFiles(folder, "*", StudioPhotoRootService.SafeEnumeration(recurse: true))
            // Our own Customer Selection copies are not new photos.
            .Where(f => !SelectionFolders.IsInsideGenerated(Path.GetRelativePath(folder, f)))
            .ToList();

        var jpegStems = files
            .Where(f => PhotoFileTypes.JpegExtensions.Contains(Path.GetExtension(f)))
            .Select(f => Path.Combine(Path.GetDirectoryName(f) ?? "", Path.GetFileNameWithoutExtension(f)))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var photos = new List<string>();
        foreach (var file in files)
        {
            if (PhotoFileTypes.IsRaw(file) &&
                jpegStems.Contains(Path.Combine(Path.GetDirectoryName(file) ?? "", Path.GetFileNameWithoutExtension(file))))
            {
                skipped.RawWithJpeg++;
            }
            else if (PhotoFileTypes.IsPhoto(file))
            {
                photos.Add(file);
            }
            else
            {
                if (PhotoFileTypes.IsVideo(file)) skipped.Videos++;
                else skipped.Other++;
                if (skipped.Examples.Count < 5) skipped.Examples.Add(Path.GetFileName(file));
            }
        }

        return (photos, skipped);
    }

    // ---- Starting an import ------------------------------------------------------------------

    public async Task<ImportStartResult> StartAsync(int studioId, int galleryId, string sourceFolder, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return ImportStartResult.Fail(ImportFailureReason.GalleryNotFound);
        }

        var (problem, checkedPath) = await photoRoots.CheckAsync(studioId, sourceFolder, ct);
        switch (problem)
        {
            case PhotoPathProblem.NoRoot: return ImportStartResult.Fail(ImportFailureReason.NoPhotoRoot);
            case PhotoPathProblem.Invalid: return ImportStartResult.Fail(ImportFailureReason.FolderInvalid);
            case PhotoPathProblem.OutsideRoot: return ImportStartResult.Fail(ImportFailureReason.FolderNotAllowed);
            case PhotoPathProblem.NotFound: return ImportStartResult.Fail(ImportFailureReason.FolderNotFound);
        }
        var full = checkedPath!;

        var latest = await galleryRepository.GetLatestJobAsync(galleryId, ct);
        if (latest is not null && latest.Status is ImportJobStatuses.Queued or ImportJobStatuses.Running)
        {
            return ImportStartResult.Fail(ImportFailureReason.AlreadyRunning);
        }

        // New files in the folder, plus photos whose previews were deleted after the retention period
        // (they are rebuilt from their originals in the same job).
        var imported = await photoRepository.GetImportedPathsAsync(galleryId, ct);
        var scan = ScanFolder(full);
        var pending = scan.Photos.Count(f => !imported.Contains(Path.GetRelativePath(full, f)))
                      + await photoRepository.CountWithoutPreviewsAsync(galleryId, ct);
        if (pending == 0)
        {
            return ImportStartResult.Fail(ImportFailureReason.NoImages, scan.Skipped);
        }

        var now = DateTime.UtcNow;
        if (gallery.PreviewsPurgedAt is not null)
        {
            await galleryRepository.ResetForPreviewRebuildAsync(galleryId, now, ct);
        }

        var job = new PhotoImportJob
        {
            PhotoGalleryId = galleryId,
            Status = ImportJobStatuses.Queued,
            SourceFolder = full,
            TotalCount = pending,
            CreatedAt = now
        };

        await galleryRepository.AddJobAsync(job, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await galleryRepository.SetSourceFolderAsync(galleryId, full, now, ct);
        await auditService.LogAsync($"Photo import started ({pending} photos)", Module, studioId, ct);
        await queue.EnqueueAsync(job.PhotoImportJobId, ct);

        var started = ToDto(job);
        started.Skipped = scan.Skipped;
        return ImportStartResult.Success(started);
    }

    public async Task<ImportStartResult> StartRebuildAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return ImportStartResult.Fail(ImportFailureReason.GalleryNotFound);
        }
        if (string.IsNullOrWhiteSpace(gallery.SourceFolder))
        {
            return ImportStartResult.Fail(ImportFailureReason.FolderNotFound);
        }

        return await StartAsync(studioId, galleryId, gallery.SourceFolder, ct);
    }

    // ---- Removing a wrongly imported folder -------------------------------------------------

    public async Task<RemoveSourceResult> RemoveSourceAsync(int studioId, int galleryId, string sourceFolder, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return RemoveSourceResult.Fail(RemoveSourceFailure.GalleryNotFound);
        }

        // Rows being read by a running import or copy job must not vanish under it.
        var import = await galleryRepository.GetLatestJobAsync(galleryId, ct);
        var copy = await copyRepository.GetLatestJobAsync(galleryId, ct);
        if (import?.Status is ImportJobStatuses.Queued or ImportJobStatuses.Running ||
            copy?.Status is ImportJobStatuses.Queued or ImportJobStatuses.Running)
        {
            return RemoveSourceResult.Fail(RemoveSourceFailure.JobRunning);
        }

        var source = sourceFolder.Trim();
        var isGallerySource = string.Equals(source, gallery.SourceFolder, StringComparison.OrdinalIgnoreCase);
        var photos = await photoRepository.GetBySourceAsync(galleryId, source, isGallerySource, ct);
        if (photos.Count == 0)
        {
            return RemoveSourceResult.Fail(RemoveSourceFailure.NotFound);
        }

        var ids = photos.Select(p => p.PhotoId).ToHashSet();
        var selected = (await photoRepository.GetSelectedAsync(galleryId, ct)).Count(s => ids.Contains(s.Photo.PhotoId));
        var files = photos.SelectMany(p => new[] { p.PreviewPath, p.ThumbnailPath }).Where(f => f is not null).ToList();
        var folderIds = photos.Where(p => p.PhotoFolderId is not null).Select(p => p.PhotoFolderId!.Value).ToHashSet();

        // Selections and "Create Selected Photos" records go with the photo rows (database cascade).
        photoRepository.RemoveRange(photos);
        await unitOfWork.SaveChangesAsync(ct);

        // Delivery folders this import created and that are now empty.
        var counts = (await folderRepository.GetCountsAsync(galleryId, ct))
            .Where(c => c.FolderId is not null && c.Total > 0).Select(c => c.FolderId!.Value).ToHashSet();
        foreach (var folder in (await folderRepository.GetByGalleryAsync(galleryId, ct))
                     .Where(f => folderIds.Contains(f.PhotoFolderId) && !counts.Contains(f.PhotoFolderId)))
        {
            folderRepository.Remove(folder);
        }
        await unitOfWork.SaveChangesAsync(ct);

        var now = DateTime.UtcNow;
        if (isGallerySource)
        {
            await galleryRepository.SetSourceFolderOrNullAsync(galleryId, await photoRepository.GetLatestSourceAsync(galleryId, ct), now, ct);
        }
        if (selected > 0)
        {
            // Lets the owner see that the Customer Selection folder needs a sync.
            await galleryRepository.MarkSelectionChangedAsync(galleryId, now, ct);
        }
        if ((await galleryRepository.GetCountsAsync(galleryId, ct)).Total == 0)
        {
            // Nothing left to show: a sent link would open an empty gallery.
            await galleryRepository.RevokeLinkAsync(galleryId, now, ct);
        }

        // Only our own preview/thumbnail copies - the originals in the studio folder stay as they are.
        foreach (var file in files)
        {
            try
            {
                fileStorage.Delete(file!);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(ex, "Couldn't delete preview {File}", file);
            }
        }

        var folderName = Path.GetFileName(source.TrimEnd('\\', '/'));
        await auditService.LogAsync($"Removed {photos.Count} photos from folder {folderName} (event {gallery.EventId})", Module, studioId, ct);
        return RemoveSourceResult.Success(photos.Count, selected);
    }

    public async Task<ImportJobDto?> GetJobAsync(int studioId, int galleryId, int jobId, CancellationToken ct = default)
    {
        // Prove the gallery belongs to this studio before exposing anything about its jobs.
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return null;
        }

        var job = await galleryRepository.GetJobAsync(galleryId, jobId, ct);
        return job is null ? null : ToDto(job);
    }

    // ---- Background processing ---------------------------------------------------------------

    public async Task<List<int>> ResumeInterruptedJobsAsync(CancellationToken ct = default)
    {
        var jobs = await galleryRepository.GetUnfinishedJobsAsync(ct);
        foreach (var job in jobs.Where(j => j.Status == ImportJobStatuses.Running))
        {
            job.Status = ImportJobStatuses.Queued;
            galleryRepository.UpdateJob(job);
        }

        if (jobs.Count > 0)
        {
            await unitOfWork.SaveChangesAsync(ct);
        }

        return jobs.Select(j => j.PhotoImportJobId).ToList();
    }

    public async Task ProcessJobAsync(int jobId, CancellationToken ct = default)
    {
        var job = await galleryRepository.GetJobByIdAsync(jobId, ct);
        if (job is null || job.Status != ImportJobStatuses.Queued)
        {
            return;
        }

        try
        {
            job.Status = ImportJobStatuses.Running;
            job.StartedAt = DateTime.UtcNow;
            galleryRepository.UpdateJob(job);
            await unitOfWork.SaveChangesAsync(ct);

            // Checked again when the job runs (it may have been queued before the studio's root changed).
            var owner = await galleryRepository.GetByIdUnscopedAsync(job.PhotoGalleryId, ct);
            if (owner is null || (await photoRoots.CheckAsync(owner.StudioId, job.SourceFolder, ct)).Problem != PhotoPathProblem.None)
            {
                throw new InvalidOperationException("The photo folder is outside this studio's photo folder.");
            }

            var imported = await photoRepository.GetImportedPathsAsync(job.PhotoGalleryId, ct);
            var todo = ListFiles(job.SourceFolder).Where(f => !imported.Contains(f.Relative)).ToList();
            var withoutPreviews = await photoRepository.GetWithoutPreviewsAsync(job.PhotoGalleryId, ct);
            job.TotalCount = todo.Count + withoutPreviews.Count;

            await RebuildPreviewsAsync(job, withoutPreviews, ct);

            var nextNumber = await photoRepository.GetMaxPhotoNumberAsync(job.PhotoGalleryId, ct) + 1;

            // Each subfolder of the source becomes a delivery folder, so the structure the studio
            // already keeps on disk is the structure the customer sees.
            var folders = await EnsureFoldersAsync(job, todo.Select(f => f.Relative), ct);

            foreach (var chunk in todo.Chunk(BatchSize))
            {
                var results = new Photo?[chunk.Length];

                await Parallel.ForEachAsync(
                    Enumerable.Range(0, chunk.Length),
                    new ParallelOptions { MaxDegreeOfParallelism = Math.Max(1, options.ImportParallelism), CancellationToken = ct },
                    async (i, token) =>
                    {
                        try
                        {
                            var preview = await previewGenerator.GenerateAsync(chunk[i].FullPath, job.PhotoGalleryId, token);
                            results[i] = new Photo
                            {
                                PhotoGalleryId = job.PhotoGalleryId,
                                FileName = Path.GetFileName(chunk[i].FullPath),
                                SourceFolder = job.SourceFolder,
                                SourceRelativePath = chunk[i].Relative,
                                PhotoFolderId = FolderIdFor(chunk[i].Relative, folders),
                                ThumbnailPath = preview.ThumbnailUrl,
                                PreviewPath = preview.PreviewUrl,
                                Width = preview.Width,
                                Height = preview.Height,
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow
                            };
                        }
                        catch (Exception ex) when (ex is not OperationCanceledException)
                        {
                            // One unreadable/corrupt file must not stop the other thousands.
                            logger.LogWarning(ex, "Preview generation failed for {File}", chunk[i].FullPath);
                        }
                    });

                // Numbers are handed out here, in file order, so they stay contiguous and stable no
                // matter which parallel worker finished first.
                var succeeded = results.Where(p => p is not null).Select(p => p!).ToList();
                foreach (var photo in succeeded)
                {
                    photo.PhotoNumber = nextNumber++;
                }

                await photoRepository.AddRangeAsync(succeeded, ct);
                job.ProcessedCount += chunk.Length;
                job.FailedCount += chunk.Length - succeeded.Count;
                galleryRepository.UpdateJob(job);
                await unitOfWork.SaveChangesAsync(ct);
            }

            job.Status = job.FailedCount == 0
                ? ImportJobStatuses.Completed
                : job.FailedCount >= job.TotalCount ? ImportJobStatuses.Failed : ImportJobStatuses.CompletedWithErrors;
            job.CompletedAt = DateTime.UtcNow;
            galleryRepository.UpdateJob(job);
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (OperationCanceledException)
        {
            // App shutting down: leave the job Running — it goes back to Queued on the next start
            // and skips photos it already imported.
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Photo import job {JobId} failed", jobId);
            job.Status = ImportJobStatuses.Failed;
            job.ErrorMessage = "The import stopped unexpectedly. Please try again.";
            job.CompletedAt = DateTime.UtcNow;
            galleryRepository.UpdateJob(job);
            await unitOfWork.SaveChangesAsync(CancellationToken.None);
        }
    }

    // Photos already in the gallery whose previews were deleted by cleanup get new ones from their
    // originals. Their numbers, folders and the customer's selections stay exactly as they were.
    private async Task RebuildPreviewsAsync(PhotoImportJob job, List<Photo> photos, CancellationToken ct)
    {
        foreach (var chunk in photos.Chunk(BatchSize))
        {
            var rebuilt = 0;

            await Parallel.ForEachAsync(
                chunk,
                new ParallelOptions { MaxDegreeOfParallelism = Math.Max(1, options.ImportParallelism), CancellationToken = ct },
                async (photo, token) =>
                {
                    var original = Path.Combine(photo.SourceFolder ?? job.SourceFolder, photo.SourceRelativePath);
                    try
                    {
                        var preview = await previewGenerator.GenerateAsync(original, job.PhotoGalleryId, token);
                        photo.ThumbnailPath = preview.ThumbnailUrl;
                        photo.PreviewPath = preview.PreviewUrl;
                        photo.Width = preview.Width;
                        photo.Height = preview.Height;
                        Interlocked.Increment(ref rebuilt);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        // The original may have been moved or deleted since the import.
                        logger.LogWarning(ex, "Preview rebuild failed for {File}", original);
                    }
                });

            job.ProcessedCount += chunk.Length;
            job.FailedCount += chunk.Length - rebuilt;
            galleryRepository.UpdateJob(job);
            await unitOfWork.SaveChangesAsync(ct);
        }
    }

    // "IMG_9" before "IMG_10": digits compare as numbers, so unpadded camera names keep shooting order.
    private static readonly IComparer<string> NaturalOrder = Comparer<string>.Create((a, b) =>
        CultureInfo.InvariantCulture.CompareInfo.Compare(a, b, CompareOptions.NumericOrdering | CompareOptions.IgnoreCase));

    private record FileEntry(string FullPath, string Relative);

    private static List<FileEntry> ListFiles(string folder) =>
        EnumerateImages(folder)
            .Select(f => new FileEntry(f, Path.GetRelativePath(folder, f)))
            .OrderBy(f => f.Relative, NaturalOrder)
            .ToList();

    private static ImportJobDto ToDto(PhotoImportJob job) => new()
    {
        JobId = job.PhotoImportJobId,
        Status = job.Status,
        TotalCount = job.TotalCount,
        ProcessedCount = job.ProcessedCount,
        FailedCount = job.FailedCount,
        ErrorMessage = job.ErrorMessage,
        StartedAt = job.StartedAt,
        CompletedAt = job.CompletedAt
    };
}
