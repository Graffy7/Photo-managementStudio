using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoProcessingJobRepository(AppDbContext context) : IPhotoProcessingJobRepository
{
    public Task<PhotoProcessingJob?> GetByIdAsync(int projectId, int jobId, CancellationToken ct = default) =>
        context.PhotoProcessingJobs
            .Include(j => j.Items).ThenInclude(i => i.Photo)
            .FirstOrDefaultAsync(j => j.PhotoSelectionProjectId == projectId && j.PhotoProcessingJobId == jobId, ct);

    public async Task AddAsync(PhotoProcessingJob job, CancellationToken ct = default) =>
        await context.PhotoProcessingJobs.AddAsync(job, ct);

    public void Update(PhotoProcessingJob job) => context.PhotoProcessingJobs.Update(job);

    public async Task AddItemsAsync(IEnumerable<PhotoProcessingJobItem> items, CancellationToken ct = default) =>
        await context.PhotoProcessingJobItems.AddRangeAsync(items, ct);
}
