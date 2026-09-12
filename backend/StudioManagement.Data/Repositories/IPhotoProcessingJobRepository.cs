using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPhotoProcessingJobRepository
{
    Task<PhotoProcessingJob?> GetByIdAsync(int projectId, int jobId, CancellationToken ct = default);
    Task AddAsync(PhotoProcessingJob job, CancellationToken ct = default);
    void Update(PhotoProcessingJob job);
    Task AddItemsAsync(IEnumerable<PhotoProcessingJobItem> items, CancellationToken ct = default);
}
