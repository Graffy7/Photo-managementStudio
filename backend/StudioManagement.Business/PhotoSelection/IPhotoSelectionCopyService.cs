namespace StudioManagement.Business.PhotoSelection;

// "Create Selected Photos" / "Sync Selected Photos": copies the customer's chosen ORIGINAL files into
// <original folder>\Customer Selection\Normal and \Big Size. Originals are only ever read.
public interface IPhotoSelectionCopyService
{
    // Queues a create (first time) or sync (afterwards) and returns immediately; the work runs in the
    // background and the job's counters drive the progress display.
    Task<CopyStartResult> StartAsync(int studioId, int galleryId, CancellationToken ct = default);
    Task<CopyJobDto?> GetJobAsync(int studioId, int galleryId, int jobId, CancellationToken ct = default);

    Task ProcessJobAsync(int jobId, CancellationToken ct = default);
    Task<List<int>> ResumeInterruptedJobsAsync(CancellationToken ct = default);
}
