using Microsoft.Extensions.Logging;
using StudioManagement.Business.Audit;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

// Safety rules this class is built around:
//  * Originals are only ever READ. Nothing here moves, renames, compresses or deletes one.
//  * Files are written only to <original folder>\Customer Selection\Normal and \Big Size.
//  * Files are deleted only if this class created them (each is recorded in PhotoSelectionCopies)
//    AND they still sit directly inside a Customer Selection\Normal / \Big Size folder.
//  * An existing file is never overwritten or duplicated ("IMG (1).jpg" is never made) — it is
//    reported as "Already Exists" and the run carries on.
public class PhotoSelectionCopyService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    IPhotoCopyRepository copyRepository,
    IPhotoCopyQueue queue,
    IAuditService auditService,
    IUnitOfWork unitOfWork,
    IStudioPhotoRootService photoRoots,
    ILogger<PhotoSelectionCopyService> logger) : IPhotoSelectionCopyService
{
    // The gallery's studio photo folder for the job being run; copies are only read and written inside it.
    private string? studioRoot;

    private bool InsideStudioRoot(string path) =>
        studioRoot is not null && StudioPhotoRootService.Check(studioRoot, path, out _) == PhotoPathProblem.None;

    private const string Module = "PhotoSelection";
    private const string TempSuffix = ".copying";
    private const int ProgressEvery = 10;

    // ---- Starting ----------------------------------------------------------------------------

    public async Task<CopyStartResult> StartAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return CopyStartResult.Fail(CopyFailureReason.GalleryNotFound);
        }

        var latestCopy = await copyRepository.GetLatestJobAsync(galleryId, ct);
        if (latestCopy is not null && latestCopy.Status is ImportJobStatuses.Queued or ImportJobStatuses.Running)
        {
            return CopyStartResult.Fail(CopyFailureReason.AlreadyRunning);
        }

        var latestImport = await galleryRepository.GetLatestJobAsync(galleryId, ct);
        if (latestImport is not null && latestImport.Status is ImportJobStatuses.Queued or ImportJobStatuses.Running)
        {
            return CopyStartResult.Fail(CopyFailureReason.ImportRunning);
        }

        if (string.IsNullOrWhiteSpace(gallery.SourceFolder))
        {
            return CopyStartResult.Fail(CopyFailureReason.NoSourceFolder);
        }
        studioRoot = await photoRoots.GetRootAsync(studioId, ct);
        if (!Directory.Exists(gallery.SourceFolder) || !InsideStudioRoot(gallery.SourceFolder))
        {
            return CopyStartResult.Fail(CopyFailureReason.SourceFolderMissing);
        }

        var counts = await galleryRepository.GetCountsAsync(galleryId, ct);
        var creating = gallery.SelectionCreatedAt is null;

        // First time: only once the customer has submitted, and only if there is something to copy.
        // A later sync is always allowed — including when the customer unselected everything, so the
        // generated copies can be cleared.
        if (creating)
        {
            if (gallery.SubmittedAt is null)
            {
                return CopyStartResult.Fail(CopyFailureReason.NotSubmitted);
            }
            if (counts.Selected == 0)
            {
                return CopyStartResult.Fail(CopyFailureReason.NothingSelected);
            }
        }

        var job = new PhotoCopyJob
        {
            PhotoGalleryId = galleryId,
            Kind = creating ? CopyJobKinds.Create : CopyJobKinds.Sync,
            Status = ImportJobStatuses.Queued,
            TotalCount = counts.Selected,
            NormalCount = counts.Normal,
            BigCount = counts.Big,
            CreatedAt = DateTime.UtcNow
        };

        await copyRepository.AddJobAsync(job, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(
            $"Selected photos {(creating ? "creation" : "sync")} started for event {gallery.EventId} ({counts.Selected} photos)", Module, studioId, ct);
        await queue.EnqueueAsync(job.PhotoCopyJobId, ct);

        return CopyStartResult.Success(ToDto(job));
    }

    public async Task<CopyJobDto?> GetJobAsync(int studioId, int galleryId, int jobId, CancellationToken ct = default)
    {
        if (await galleryRepository.GetByIdAsync(studioId, galleryId, ct) is null)
        {
            return null;
        }

        var job = await copyRepository.GetJobAsync(galleryId, jobId, ct);
        return job is null ? null : ToDto(job);
    }

    public async Task<List<int>> ResumeInterruptedJobsAsync(CancellationToken ct = default)
    {
        var jobs = await copyRepository.GetUnfinishedJobsAsync(ct);
        foreach (var job in jobs.Where(j => j.Status == ImportJobStatuses.Running))
        {
            // Safe to run again from the top: what was already copied is recorded, so it is skipped.
            job.Status = ImportJobStatuses.Queued;
            copyRepository.UpdateJob(job);
        }

        if (jobs.Count > 0)
        {
            await unitOfWork.SaveChangesAsync(ct);
        }

        return jobs.Select(j => j.PhotoCopyJobId).ToList();
    }

    // ---- Doing the work ----------------------------------------------------------------------

    public async Task ProcessJobAsync(int jobId, CancellationToken ct = default)
    {
        var job = await copyRepository.GetJobByIdAsync(jobId, ct);
        if (job is null || job.Status != ImportJobStatuses.Queued)
        {
            return;
        }

        var failures = new List<string>();
        void Fail(string fileName, string reason)
        {
            job.FailedCount++;
            if (failures.Count < 5)
            {
                failures.Add($"{fileName}: {reason}");
            }
        }

        try
        {
            var startedAt = DateTime.UtcNow;
            job.Status = ImportJobStatuses.Running;
            job.StartedAt = startedAt;
            copyRepository.UpdateJob(job);
            await unitOfWork.SaveChangesAsync(ct);

            var gallery = await galleryRepository.GetByIdUnscopedAsync(job.PhotoGalleryId, ct)
                ?? throw new InvalidOperationException("Gallery not found.");
            studioRoot = await photoRoots.GetRootAsync(gallery.StudioId, ct);

            // The selection as it is right now (the customer may have changed it since the button was
            // pressed). A change made during the run is picked up by the next sync.
            var selected = (await photoRepository.GetSelectedAsync(job.PhotoGalleryId, ct))
                .Where(s => s.SelectionType is not null)
                .ToList();
            job.TotalCount = selected.Count;
            job.NormalCount = selected.Count(s => s.SelectionType == SelectionTypes.Normal);
            job.BigCount = selected.Count(s => s.SelectionType == SelectionTypes.Big);

            var copies = await copyRepository.GetCopiesAsync(job.PhotoGalleryId, ct);
            var selectedById = selected.ToDictionary(s => s.Photo.PhotoId);
            var blocked = new HashSet<int>();

            // 1. Take away generated copies that no longer match the selection: the photo was
            //    unselected, or its size changed (so it moves from one folder to the other).
            foreach (var copy in copies.ToList())
            {
                if (selectedById.TryGetValue(copy.PhotoId, out var current) && current.SelectionType == copy.SelectionType)
                {
                    continue;
                }

                try
                {
                    DeleteGeneratedCopy(copy.DestinationPath);
                    copyRepository.RemoveCopy(copy);
                    copies.Remove(copy);
                    job.RemovedCount++;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException)
                {
                    logger.LogWarning(ex, "Couldn't remove generated copy {Path}", copy.DestinationPath);
                    blocked.Add(copy.PhotoId);
                    Fail(Path.GetFileName(copy.DestinationPath), "the old copy couldn't be removed (is it open in another program?)");
                }
            }
            await unitOfWork.SaveChangesAsync(ct);

            // 2. Make sure both folders exist (an empty Big Size folder is still created).
            PrepareFolders(gallery, selected);

            var copiesByPhoto = copies.ToDictionary(c => c.PhotoId);
            var destinationOwner = copies.ToDictionary(c => c.DestinationPath, c => c.PhotoId, StringComparer.OrdinalIgnoreCase);

            // 3. Copy what is missing.
            foreach (var entry in selected)
            {
                ct.ThrowIfCancellationRequested();

                var photo = entry.Photo;
                var type = entry.SelectionType!.Value;

                if (blocked.Contains(photo.PhotoId))
                {
                    job.ProcessedCount++;
                    continue;
                }

                try
                {
                    copiesByPhoto.TryGetValue(photo.PhotoId, out var tracked);
                    var outcome = await CopyOneAsync(gallery, photo, type, tracked, destinationOwner, job.PhotoGalleryId, ct);
                    if (outcome == CopyOutcome.Created)
                    {
                        job.CreatedCount++;
                    }
                    else
                    {
                        job.ExistsCount++;
                    }
                }
                catch (CopyProblemException ex)
                {
                    Fail(photo.FileName, ex.Message);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    logger.LogWarning(ex, "Couldn't copy {File}", photo.FileName);
                    Fail(photo.FileName, "couldn't be copied (the disk may be full, or the file is in use)");
                }

                job.ProcessedCount++;
                if (job.ProcessedCount % ProgressEvery == 0)
                {
                    await unitOfWork.SaveChangesAsync(ct);
                }
            }

            job.Status = job.FailedCount == 0
                ? ImportJobStatuses.Completed
                : job.CreatedCount + job.ExistsCount + job.RemovedCount == 0
                    ? ImportJobStatuses.Failed
                    : ImportJobStatuses.CompletedWithErrors;
            job.ErrorMessage = BuildErrorMessage(failures, job.FailedCount);
            job.CompletedAt = DateTime.UtcNow;
            await unitOfWork.SaveChangesAsync(ct);

            if (job.Status != ImportJobStatuses.Failed)
            {
                await galleryRepository.MarkSelectionSyncedAsync(job.PhotoGalleryId, startedAt, ct);
            }

            await auditService.LogAsync(
                $"Selected photos {(job.Kind == CopyJobKinds.Create ? "created" : "synced")} for event {gallery.EventId}: " +
                $"{job.CreatedCount} created, {job.ExistsCount} already existed, {job.RemovedCount} removed, {job.FailedCount} failed",
                Module, gallery.StudioId, ct);
        }
        catch (OperationCanceledException)
        {
            // Shutting down: left Running, re-queued on the next start, and it resumes safely.
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Selected-photos job {JobId} failed", jobId);
            job.Status = ImportJobStatuses.Failed;
            job.ErrorMessage = "This stopped unexpectedly. Nothing was removed from your original photos. Please try again.";
            job.CompletedAt = DateTime.UtcNow;
            copyRepository.UpdateJob(job);
            await unitOfWork.SaveChangesAsync(CancellationToken.None);
        }
    }

    private enum CopyOutcome { Created, Exists }

    // A reason a single photo can't be copied that the owner should read as plain words.
    private sealed class CopyProblemException(string message) : Exception(message);

    private async Task<CopyOutcome> CopyOneAsync(
        PhotoGallery gallery,
        Photo photo,
        int type,
        PhotoSelectionCopy? tracked,
        Dictionary<string, int> destinationOwner,
        int galleryId,
        CancellationToken ct)
    {
        var root = photo.SourceFolder ?? gallery.SourceFolder;
        if (string.IsNullOrWhiteSpace(root))
        {
            throw new CopyProblemException("the original's folder isn't recorded");
        }

        var rootFull = Path.GetFullPath(root);
        if (!InsideStudioRoot(rootFull))
        {
            throw new CopyProblemException("that folder isn't allowed");
        }

        // The original, located from the stored path — and never outside its own folder.
        var source = Path.GetFullPath(Path.Combine(rootFull, photo.SourceRelativePath));
        if (!IsUnder(source, rootFull))
        {
            throw new CopyProblemException("its stored path isn't valid");
        }
        if (!File.Exists(source))
        {
            throw new CopyProblemException("the original file wasn't found (moved or deleted?)");
        }

        var destinationDirectory = Path.Combine(rootFull, SelectionFolders.RootName, SelectionFolders.NameFor(type));
        var destination = Path.Combine(destinationDirectory, Path.GetFileName(source));

        // Two different photos can share a file name (same name in two sub-folders). They can't both
        // occupy one place, and neither may overwrite the other.
        if (destinationOwner.TryGetValue(destination, out var owner) && owner != photo.PhotoId)
        {
            throw new CopyProblemException("another selected photo with the same file name is already in that folder");
        }

        if (tracked is not null)
        {
            if (string.Equals(tracked.DestinationPath, destination, StringComparison.OrdinalIgnoreCase))
            {
                if (File.Exists(destination))
                {
                    return CopyOutcome.Exists;
                }
                // Our copy was deleted by hand — put it back below.
            }
            else
            {
                // The copy was made somewhere else (the photo's folder changed): clear that one first.
                try
                {
                    DeleteGeneratedCopy(tracked.DestinationPath);
                }
                catch (InvalidOperationException)
                {
                    throw new CopyProblemException("an old copy in a different folder couldn't be replaced");
                }
                destinationOwner.Remove(tracked.DestinationPath);
            }
        }
        else if (File.Exists(destination))
        {
            // Not made by us (or made by an earlier run that didn't record it): leave it exactly as is.
            destinationOwner[destination] = photo.PhotoId;
            return CopyOutcome.Exists;
        }

        Directory.CreateDirectory(destinationDirectory);
        CopyWithoutOverwriting(source, destination);
        destinationOwner[destination] = photo.PhotoId;

        if (tracked is null)
        {
            await copyRepository.AddCopyAsync(new PhotoSelectionCopy
            {
                PhotoGalleryId = galleryId,
                PhotoId = photo.PhotoId,
                SelectionType = type,
                DestinationPath = destination,
                CreatedAt = DateTime.UtcNow
            }, ct);
        }
        else
        {
            tracked.SelectionType = type;
            tracked.DestinationPath = destination;
        }

        // Recorded straight away, so a crash can't leave a generated file the system has forgotten.
        await unitOfWork.SaveChangesAsync(ct);
        return CopyOutcome.Created;
    }

    // Copies to a temporary name and renames into place, so a half-written file never has the
    // photo's real name, and never overwrites whatever might already be there.
    private static void CopyWithoutOverwriting(string source, string destination)
    {
        var temp = $"{destination}.{Guid.NewGuid():N}{TempSuffix}";
        try
        {
            File.Copy(source, temp, overwrite: false);
            File.Move(temp, destination, overwrite: false);
        }
        catch
        {
            try
            {
                if (File.Exists(temp))
                {
                    File.Delete(temp);
                }
            }
            catch (IOException)
            {
            }
            throw;
        }
    }

    // The only place this class deletes a file. It refuses anything that isn't directly inside a
    // "Customer Selection\Normal" or "Customer Selection\Big Size" folder.
    private static void DeleteGeneratedCopy(string path)
    {
        var full = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(full);
        var parent = directory is null ? null : Path.GetDirectoryName(directory);

        var inSelectionFolder =
            directory is not null && parent is not null &&
            (Path.GetFileName(directory).Equals(SelectionFolders.NormalName, StringComparison.OrdinalIgnoreCase) ||
             Path.GetFileName(directory).Equals(SelectionFolders.BigName, StringComparison.OrdinalIgnoreCase)) &&
            Path.GetFileName(parent).Equals(SelectionFolders.RootName, StringComparison.OrdinalIgnoreCase);

        if (!inSelectionFolder)
        {
            throw new InvalidOperationException("Refusing to delete a file outside Customer Selection.");
        }

        if (File.Exists(full))
        {
            File.SetAttributes(full, FileAttributes.Normal);
            File.Delete(full);
        }
    }

    private void PrepareFolders(PhotoGallery gallery, List<PhotoWithSelection> selected)
    {
        var roots = selected.Select(s => s.Photo.SourceFolder ?? gallery.SourceFolder)
            .Append(gallery.SourceFolder)
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => Path.GetFullPath(r!))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var root in roots)
        {
            // Never invent the original folder itself: if it's missing (drive not connected), each photo
            // reports "original not found" instead of a new empty tree appearing.
            if (!Directory.Exists(root) || !InsideStudioRoot(root))
            {
                continue;
            }

            foreach (var name in new[] { SelectionFolders.NormalName, SelectionFolders.BigName })
            {
                var directory = Path.Combine(root, SelectionFolders.RootName, name);
                try
                {
                    Directory.CreateDirectory(directory);

                    // Leftovers of a copy that was interrupted (our own temporary names only).
                    foreach (var leftover in Directory.EnumerateFiles(directory, $"*{TempSuffix}"))
                    {
                        File.Delete(leftover);
                    }
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    logger.LogWarning(ex, "Couldn't prepare {Folder}", directory);
                }
            }
        }
    }

    private static bool IsUnder(string path, string root) =>
        path.StartsWith(root.TrimEnd('\\', '/') + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);

    private static string? BuildErrorMessage(List<string> failures, int failedCount)
    {
        if (failures.Count == 0)
        {
            return null;
        }

        var message = string.Join("; ", failures);
        if (failedCount > failures.Count)
        {
            message += $"; and {failedCount - failures.Count} more";
        }
        return message.Length > 1000 ? message[..1000] : message;
    }

    internal static CopyJobDto ToDto(PhotoCopyJob job) => new()
    {
        JobId = job.PhotoCopyJobId,
        Kind = job.Kind,
        Status = job.Status,
        TotalCount = job.TotalCount,
        NormalCount = job.NormalCount,
        BigCount = job.BigCount,
        ProcessedCount = job.ProcessedCount,
        CreatedCount = job.CreatedCount,
        ExistsCount = job.ExistsCount,
        RemovedCount = job.RemovedCount,
        FailedCount = job.FailedCount,
        ErrorMessage = job.ErrorMessage,
        StartedAt = job.StartedAt,
        CompletedAt = job.CompletedAt
    };
}
