using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class StudioUsageRepository(AppDbContext context) : IStudioUsageRepository
{
    public async Task AddAsync(IReadOnlyCollection<UsageIncrement> increments, CancellationToken ct = default)
    {
        foreach (var inc in increments)
        {
            var day = inc.UsageDate.Date;
            var row = await context.StudioDailyUsages.FirstOrDefaultAsync(u => u.StudioId == inc.StudioId && u.UsageDate == day, ct);
            if (row is null)
            {
                context.StudioDailyUsages.Add(new StudioDailyUsage
                {
                    StudioId = inc.StudioId,
                    UsageDate = day,
                    ActiveMinutes = inc.ActiveMinutes,
                    RequestCount = inc.RequestCount,
                    LastSeenAt = inc.LastSeenAt
                });
            }
            else
            {
                row.ActiveMinutes += inc.ActiveMinutes;
                row.RequestCount += inc.RequestCount;
                if (inc.LastSeenAt > row.LastSeenAt)
                {
                    row.LastSeenAt = inc.LastSeenAt;
                }
            }
        }

        await context.SaveChangesAsync(ct);
    }

    public Task<List<StudioDailyUsage>> GetForStudioAsync(int studioId, DateTime fromDate, DateTime toDate, CancellationToken ct = default) =>
        context.StudioDailyUsages.AsNoTracking()
            .Where(u => u.StudioId == studioId && u.UsageDate >= fromDate.Date && u.UsageDate <= toDate.Date)
            .OrderBy(u => u.UsageDate)
            .ToListAsync(ct);

    public async Task<Dictionary<int, DateTime>> GetLastSeenAsync(CancellationToken ct = default) =>
        await context.StudioDailyUsages.AsNoTracking()
            .GroupBy(u => u.StudioId)
            .Select(g => new { g.Key, Last = g.Max(u => u.LastSeenAt) })
            .ToDictionaryAsync(x => x.Key, x => x.Last, ct);
}
