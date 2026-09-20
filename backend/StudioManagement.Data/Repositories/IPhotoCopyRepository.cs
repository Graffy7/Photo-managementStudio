using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPhotoCopyRepository
{
    Task<PhotoCopyJob?> GetJobAsync(int galleryId, int jobId, CancellationToken ct = default);
    Task<PhotoCopyJob?> GetJobByIdAsync(int jobId, CancellationToken ct = default);
    Task<PhotoCopyJob?> GetLatestJobAsync(int galleryId, CancellationToken ct = default);
    Task<List<PhotoCopyJob>> GetUnfinishedJobsAsync(CancellationToken ct = default);
    Task AddJobAsync(PhotoCopyJob job, CancellationToken ct = default);
    void UpdateJob(PhotoCopyJob job);

    // Generated files this system has written for the gallery (tracked, so it can remove exactly
    // those and nothing else).
    Task<List<PhotoSelectionCopy>> GetCopiesAsync(int galleryId, CancellationToken ct = default);
    Task AddCopyAsync(PhotoSelectionCopy copy, CancellationToken ct = default);
    void RemoveCopy(PhotoSelectionCopy copy);
}
