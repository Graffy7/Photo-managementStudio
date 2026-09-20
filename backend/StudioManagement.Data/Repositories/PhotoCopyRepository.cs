using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoCopyRepository(AppDbContext context) : IPhotoCopyRepository
{
    public Task<PhotoCopyJob?> GetJobAsync(int galleryId, int jobId, CancellationToken ct = default) =>
        context.PhotoCopyJobs.AsNoTracking()
            .FirstOrDefaultAsync(j => j.PhotoGalleryId == galleryId && j.PhotoCopyJobId == jobId, ct);

    public Task<PhotoCopyJob?> GetJobByIdAsync(int jobId, CancellationToken ct = default) =>
        context.PhotoCopyJobs.AsNoTracking().FirstOrDefaultAsync(j => j.PhotoCopyJobId == jobId, ct);

    public Task<PhotoCopyJob?> GetLatestJobAsync(int galleryId, CancellationToken ct = default) =>
        context.PhotoCopyJobs.AsNoTracking()
            .Where(j => j.PhotoGalleryId == galleryId)
            .OrderByDescending(j => j.CreatedAt).ThenByDescending(j => j.PhotoCopyJobId)
            .FirstOrDefaultAsync(ct);

    public Task<List<PhotoCopyJob>> GetUnfinishedJobsAsync(CancellationToken ct = default) =>
        context.PhotoCopyJobs.AsNoTracking()
            .Where(j => j.Status == ImportJobStatuses.Queued || j.Status == ImportJobStatuses.Running)
            .OrderBy(j => j.CreatedAt)
            .ToListAsync(ct);

    public async Task AddJobAsync(PhotoCopyJob job, CancellationToken ct = default) =>
        await context.PhotoCopyJobs.AddAsync(job, ct);

    public void UpdateJob(PhotoCopyJob job) => context.PhotoCopyJobs.Update(job);

    public Task<List<PhotoSelectionCopy>> GetCopiesAsync(int galleryId, CancellationToken ct = default) =>
        context.PhotoSelectionCopies.Where(c => c.PhotoGalleryId == galleryId).ToListAsync(ct);

    public async Task AddCopyAsync(PhotoSelectionCopy copy, CancellationToken ct = default) =>
        await context.PhotoSelectionCopies.AddAsync(copy, ct);

    public void RemoveCopy(PhotoSelectionCopy copy) => context.PhotoSelectionCopies.Remove(copy);
}
