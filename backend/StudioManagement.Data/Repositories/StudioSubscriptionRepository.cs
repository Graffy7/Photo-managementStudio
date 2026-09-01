using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class StudioSubscriptionRepository(AppDbContext context) : Repository<StudioSubscription>(context), IStudioSubscriptionRepository
{
    public Task<StudioSubscription?> GetCurrentAsync(int studioId, CancellationToken ct = default) =>
        Set.Include(s => s.SubscriptionPlan)
            .Where(s => s.StudioId == studioId)
            .OrderByDescending(s => s.StartDate)
            .FirstOrDefaultAsync(ct);
}
