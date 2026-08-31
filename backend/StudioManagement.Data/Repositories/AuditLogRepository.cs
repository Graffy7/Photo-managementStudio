using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class AuditLogRepository(AppDbContext context) : Repository<AuditLog>(context), IAuditLogRepository
{
    public async Task<(List<AuditLog> Items, int TotalCount)> SearchAsync(int? studioId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking().AsQueryable();

        if (studioId is not null)
        {
            query = query.Where(a => a.StudioId == studioId);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }
}
