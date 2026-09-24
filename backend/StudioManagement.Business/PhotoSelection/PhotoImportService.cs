using System.Globalization;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Audit;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public class PhotoImportService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    IPhotoFolderRepository folderRepository,
    IPhotoPreviewGenerator previewGenerator,
    IPhotoImportQueue queue,
    IAuditService auditService,
    IUnitOfWork unitOfWork,
    PhotoGalleryOptions options,
    ILogger<PhotoImportService> logger) : IPhotoImportService
{
    private const string Module = "PhotoSelection";
    private const int BatchSize = 24;

    // Formats the image library can decode. (Camera RAW files aren't supported — export JPEGs first.)
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"
    };

    // ---- Folder browsing -------------------------------------------------------------------

    public FolderBrowseResultDto? BrowseFolders(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return new FolderBrowseResultDto { Folders = TopLevelEntries() };
        }

        string full;
        try
        {
            full = Path.GetFullPath(path.Trim());
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return null;
        }

        if (!Directory.Exists(full) || !IsAllowed(full))
        {
            return null;
        }

        try
        {
            var folders = Directory.EnumerateDirectories(full, "*", new EnumerationOptions { IgnoreInaccessible = true })
                .Select(p => new FolderBrowseEntryDto { Name = Path.GetFileName(p), FullPath = p })
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var parent = Directory.GetParent(full)?.FullName;
            // At an allowed root, "up" goes back to the top-level list rather than outside the root.
            if (parent is not null && !IsAllowed(parent))
            {
                parent = null;
            }

            return new FolderBrowseResultDto
            {
                CurrentPath = full,
                ParentPath = parent,
                Folders = folders,
                ImageCount = EnumerateImages(full).Count()
            };
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException)
        {
            return null;
        }
    }

    // Mirrors what Windows' "This PC" opens to: the user's library folders first (where photos most
    // likely live), then the drives — or just the configured roots when imports are restricted.
    private List<FolderBrowseEntryDto> TopLevelEntries()
    {
        if (options.AllowedImportRoots.Length > 0)
        {
            return options.AllowedImportRoots
                .Where(Directory.Exists)
                .Select(r => new FolderBrowseEntryDto { Name = Path.GetFileName(r.TrimEnd('\\', '/')) is { Length: > 0 } n ? n : r, FullPath = Path.GetFullPath(r) })
                .ToList();
        }

        var entries = new List<FolderBrowseEntryDto>();
        foreach (var (name, folder) in new[]
        {
            ("Desktop", Environment.SpecialFolder.DesktopDirectory),
            ("Documents", Environment.SpecialFolder.MyDocuments),
            ("Pictures", Environment.SpecialFolder.MyPictures),
            ("Videos", Environment.SpecialFolder.MyVideos)
        })
        {
            var p = Environment.GetFolderPath(folder);
            if (!string.IsNullOrEmpty(p) && Directory.Exists(p))
            {
                entries.Add(new FolderBrowseEntryDto { Name = name, FullPath = p });
            }
        }

        var downloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        if (Directory.Exists(downloads))
        {
            entries.Insert(Math.Min(1, entries.Count), new FolderBrowseEntryDto { Name = "Downloads", FullPath = downloads });
        }

        entries.AddRange(DriveInfo.GetDrives()
            .Where(d => d.IsReady)
            .OrderBy(d => d.Name)
            .Select(d => new FolderBrowseEntryDto { Name = d.Name, FullPath = d.Name }));
        return entries;
    }

    private bool IsAllowed(string fullPath) => options.IsAllowed(fullPath);

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

    private static IEnumerable<string> EnumerateImages(string folder) =>
        Directory.EnumerateFiles(folder, "*", new EnumerationOptions { RecurseSubdirectories = true, IgnoreInaccessible = true })
            .Where(f => ImageExtensions.Contains(Path.GetExtension(f)))
            // Our own Customer Selection copies are not new photos.
            .Where(f => !SelectionFolders.IsInsideGenerated(Path.GetRelativePath(folder, f)));

    // ---- Starting an import ------------------------------------------------------------------

    public async Task<ImportStartResult> StartAsync(int studioId, int galleryId, string sourceFolder, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return ImportStartResult.Fail(ImportFailureReason.GalleryNotFound);
        }

        string full;
        try
        {
            full = Path.GetFullPath(sourceFolder.Trim());
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return ImportStartResult.Fail(ImportFailureReason.FolderNotFound);
        }

        if (!Directory.Exists(full))
        {
            return ImportStartResult.Fail(ImportFailureReason.FolderNotFound);
        }
        if (!IsAllowed(full))
        {
            return ImportStartResult.Fail(ImportFailureReason.FolderNotAllowed);
        }

        var latest = await galleryRepository.GetLatestJobAsync(galleryId, ct);
        if (latest is not null && latest.Status is ImportJobStatuses.Queued or ImportJobStatuses.Running)
        {
            return ImportStartResult.Fail(ImportFailureReason.AlreadyRunning);
        }

        var imported = await photoRepository.GetImportedPathsAsync(galleryId, ct);
        var pending = ListFiles(full).Count(f => !imported.Contains(f.Relative));
        if (pending == 0)
        {
            return ImportStartResult.Fail(ImportFailureReason.NoImages);
        }

        var now = DateTime.UtcNow;
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

        return ImportStartResult.Success(ToDto(job));
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

            var imported = await photoRepository.GetImportedPathsAsync(job.PhotoGalleryId, ct);
            var todo = ListFiles(job.SourceFolder).Where(f => !imported.Contains(f.Relative)).ToList();
            job.TotalCount = todo.Count;

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
