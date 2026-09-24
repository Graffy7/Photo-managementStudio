namespace StudioManagement.Business.PhotoSelection;

public interface IPhotoImportService
{
    // Lists the sub-folders of a path on the studio machine (drives when no path is given), so the
    // owner can pick where the originals live instead of typing it. Null = not a readable folder.
    FolderBrowseResultDto? BrowseFolders(string? path);

    Task<ImportStartResult> StartAsync(int studioId, int galleryId, string sourceFolder, CancellationToken ct = default);
    // Rebuilds the previews that cleanup deleted, from the originals in the gallery's own folder.
    Task<ImportStartResult> StartRebuildAsync(int studioId, int galleryId, CancellationToken ct = default);
    // Takes the photos imported from one folder back out of the gallery (e.g. the wrong folder was
    // picked): their rows, selections and preview files go; the original files are never touched.
    Task<RemoveSourceResult> RemoveSourceAsync(int studioId, int galleryId, string sourceFolder, CancellationToken ct = default);
    Task<ImportJobDto?> GetJobAsync(int studioId, int galleryId, int jobId, CancellationToken ct = default);

    // Called by the background worker. Reads originals, writes previews, records progress; the
    // originals themselves are never modified.
    Task ProcessJobAsync(int jobId, CancellationToken ct = default);

    // On startup: anything left Running by a stopped app goes back to Queued; returns every job id
    // that still needs processing.
    Task<List<int>> ResumeInterruptedJobsAsync(CancellationToken ct = default);
}
