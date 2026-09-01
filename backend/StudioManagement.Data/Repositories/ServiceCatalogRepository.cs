using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class ServiceCatalogRepository(AppDbContext context) : IServiceCatalogRepository
{
    public Task<Service?> GetByIdAsync(int studioId, int serviceId, CancellationToken ct = default) =>
        context.Services.FirstOrDefaultAsync(s => s.StudioId == studioId && s.ServiceId == serviceId, ct);

    public async Task<(List<Service> Items, int TotalCount)> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Services
            .AsNoTracking()
            .Where(s => s.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(s => s.ServiceName.Contains(term));
        }

        if (isActive is not null)
        {
            query = query.Where(s => s.IsActive == isActive);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderBy(s => s.ServiceName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task AddAsync(Service service, CancellationToken ct = default) =>
        await context.Services.AddAsync(service, ct);

    public void Update(Service service) => context.Services.Update(service);
}
