using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoSelectionProjectRepository(AppDbContext context) : IPhotoSelectionProjectRepository
{
    public Task<PhotoSelectionProject?> GetByIdAsync(int studioId, int projectId, CancellationToken ct = default) =>
        context.PhotoSelectionProjects
            .Include(p => p.Customer)
            .Include(p => p.Event)
            .FirstOrDefaultAsync(p => p.StudioId == studioId && p.PhotoSelectionProjectId == projectId, ct);

    public Task<List<PhotoSelectionProject>> SearchAsync(int studioId, int? customerId, int? eventId, CancellationToken ct = default)
    {
        var query = context.PhotoSelectionProjects
            .AsNoTracking()
            .Include(p => p.Customer)
            .Include(p => p.Event)
            .Where(p => p.StudioId == studioId);

        if (customerId is not null)
        {
            query = query.Where(p => p.CustomerId == customerId);
        }
        if (eventId is not null)
        {
            query = query.Where(p => p.EventId == eventId);
        }

        return query.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
    }

    public Task<List<PhotoSelectionProject>> GetByEventIdsAsync(int studioId, List<int> eventIds, CancellationToken ct = default)
    {
        if (eventIds.Count == 0)
        {
            return Task.FromResult(new List<PhotoSelectionProject>());
        }

        return context.PhotoSelectionProjects
            .AsNoTracking()
            .Where(p => p.StudioId == studioId && p.EventId != null && eventIds.Contains(p.EventId.Value))
            .ToListAsync(ct);
    }

    public Task<PhotoSelectionProject?> GetByIdAsync(int projectId, CancellationToken ct = default) =>
        context.PhotoSelectionProjects
            .Include(p => p.Customer)
            .Include(p => p.Event)
            .FirstOrDefaultAsync(p => p.PhotoSelectionProjectId == projectId, ct);

    public Task<PhotoSelectionProject?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        context.PhotoSelectionProjects
            .Include(p => p.Customer)
            .Include(p => p.Event)
            .FirstOrDefaultAsync(p => p.AccessTokenHash == tokenHash, ct);

    public async Task AddAsync(PhotoSelectionProject project, CancellationToken ct = default) =>
        await context.PhotoSelectionProjects.AddAsync(project, ct);

    public void Update(PhotoSelectionProject project) => context.PhotoSelectionProjects.Update(project);
}
