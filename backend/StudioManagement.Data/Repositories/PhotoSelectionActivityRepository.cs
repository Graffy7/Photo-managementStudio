using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoSelectionActivityRepository(AppDbContext context) : IPhotoSelectionActivityRepository
{
    public async Task AddAsync(PhotoSelectionActivity activity, CancellationToken ct = default) =>
        await context.PhotoSelectionActivities.AddAsync(activity, ct);

    public Task<List<PhotoSelectionActivity>> SearchAsync(int projectId, CancellationToken ct = default) =>
        context.PhotoSelectionActivities
            .AsNoTracking()
            .Include(a => a.Photo)
            .Where(a => a.PhotoSelectionProjectId == projectId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);
}
