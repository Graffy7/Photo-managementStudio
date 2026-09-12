using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoRepository(AppDbContext context) : IPhotoRepository
{
    public Task<Photo?> GetByIdAsync(int projectId, int photoId, CancellationToken ct = default) =>
        context.Photos.FirstOrDefaultAsync(p => p.PhotoSelectionProjectId == projectId && p.PhotoId == photoId, ct);

    public Task<List<Photo>> SearchAsync(int projectId, int? afterPhotoNumber, int limit, CancellationToken ct = default)
    {
        var query = context.Photos
            .AsNoTracking()
            .Where(p => p.PhotoSelectionProjectId == projectId);

        if (afterPhotoNumber is not null)
        {
            query = query.Where(p => p.PhotoNumber > afterPhotoNumber.Value);
        }

        return query.OrderBy(p => p.PhotoNumber).Take(limit).ToListAsync(ct);
    }

    public async Task<(int Total, int Normal, int Big)> GetCountsAsync(int projectId, CancellationToken ct = default)
    {
        var counts = await context.Photos
            .AsNoTracking()
            .Where(p => p.PhotoSelectionProjectId == projectId)
            .GroupBy(p => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Normal = g.Count(p => p.SelectionType == PhotoSelectionTypes.Normal),
                Big = g.Count(p => p.SelectionType == PhotoSelectionTypes.Big)
            })
            .FirstOrDefaultAsync(ct);

        return counts is null ? (0, 0, 0) : (counts.Total, counts.Normal, counts.Big);
    }

    public Task<List<Photo>> GetSelectedAsync(int projectId, CancellationToken ct = default) =>
        context.Photos
            .AsNoTracking()
            .Where(p => p.PhotoSelectionProjectId == projectId && p.SelectionType != PhotoSelectionTypes.None)
            .OrderBy(p => p.PhotoNumber)
            .ToListAsync(ct);

    public async Task<int> GetMaxPhotoNumberAsync(int projectId, CancellationToken ct = default)
    {
        var max = await context.Photos
            .Where(p => p.PhotoSelectionProjectId == projectId)
            .Select(p => (int?)p.PhotoNumber)
            .MaxAsync(ct);
        return max ?? 0;
    }

    public async Task AddRangeAsync(IEnumerable<Photo> photos, CancellationToken ct = default) =>
        await context.Photos.AddRangeAsync(photos, ct);

    public void Update(Photo photo) => context.Photos.Update(photo);
}
