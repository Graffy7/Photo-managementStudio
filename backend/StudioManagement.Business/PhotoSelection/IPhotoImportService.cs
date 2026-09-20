namespace StudioManagement.Business.PhotoSelection;

public interface IPhotoImportService
{
    // Lists the sub-folders of a path on the studio machine (drives when no path is given), so the
    // owner can pick where the originals live instead of typing it. Null = not a readable folder.
    FolderBrowseResultDto? BrowseFolders(string? path);

    Task<ImportStartResult> StartAsync(int studioId, int galleryId, string sourceFolder, CancellationToken ct = default);
    Task<ImportJobDto?> GetJobAsync(int studioId, int galleryId, int jobId, CancellationToken ct = default);

    // Called by the background worker. Reads originals, writes previews, records progress; the
    // originals themselves are never modified.
    Task ProcessJobAsync(int jobId, CancellationToken ct = default);

    // On startup: anything left Running by a stopped app goes back to Queued; returns every job id
    // that still needs processing.
    Task<List<int>> ResumeInterruptedJobsAsync(CancellationToken ct = default);
}
