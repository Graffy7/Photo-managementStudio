using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class StudioRepository(AppDbContext context) : Repository<Studio>(context), IStudioRepository
{
    public override Task<Studio?> GetByIdAsync(int id, CancellationToken ct = default) =>
        Set.Include(s => s.Subscriptions).ThenInclude(sub => sub.SubscriptionPlan)
            .FirstOrDefaultAsync(s => s.StudioId == id, ct);

    public async Task<(List<Studio> Items, int TotalCount)> SearchAsync(string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        var query = Set.AsNoTracking()
            .Include(s => s.Subscriptions).ThenInclude(sub => sub.SubscriptionPlan)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(s => s.StudioName.Contains(term) || s.Email.Contains(term));
        }

        if (isActive is not null)
        {
            query = query.Where(s => s.IsActive == isActive);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<bool> EmailExistsAsync(string email, CancellationToken ct = default) =>
        Set.AnyAsync(s => s.Email == email, ct);

    public Task<List<Studio>> GetByIdsAsync(IEnumerable<int> ids, CancellationToken ct = default) =>
        Set.AsNoTracking().Where(s => ids.Contains(s.StudioId)).ToListAsync(ct);

    public Task<List<int>> GetActiveStudioIdsAsync(CancellationToken ct = default) =>
        Set.AsNoTracking().Where(s => s.IsActive).Select(s => s.StudioId).ToListAsync(ct);
}
