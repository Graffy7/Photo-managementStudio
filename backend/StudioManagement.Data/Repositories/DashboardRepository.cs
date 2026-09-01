using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;

namespace StudioManagement.Data.Repositories;

public class DashboardRepository(AppDbContext context) : IDashboardRepository
{
    // Each studio may accumulate multiple subscription periods over time — these queries always
    // reason about the studio's current (latest by StartDate) subscription, never the full history.
    private IQueryable<Entities.StudioSubscription> LatestSubscriptionPerStudio()
    {
        var latestIds = context.StudioSubscriptions
            .GroupBy(s => s.StudioId)
            .Select(g => g.OrderByDescending(s => s.StartDate).Select(s => s.StudioSubscriptionId).First());

        return context.StudioSubscriptions.Where(s => latestIds.Contains(s.StudioSubscriptionId));
    }

    public Task<int> CountTotalStudiosAsync(CancellationToken ct = default) =>
        context.Studios.CountAsync(ct);

    public Task<int> CountActiveStudiosAsync(CancellationToken ct = default) =>
        context.Studios.CountAsync(s => s.IsActive, ct);

    public Task<int> CountBlockedStudiosAsync(CancellationToken ct = default) =>
        context.Studios.CountAsync(s => s.IsBlocked, ct);

    public Task<int> CountNewStudiosSinceAsync(DateTime since, CancellationToken ct = default) =>
        context.Studios.CountAsync(s => s.CreatedAt >= since, ct);

    public Task<int> CountExpiredSubscriptionsAsync(DateTime asOf, CancellationToken ct = default) =>
        LatestSubscriptionPerStudio().CountAsync(s => s.EndDate < asOf, ct);

    public Task<int> CountExpiringSoonAsync(DateTime asOf, DateTime before, CancellationToken ct = default) =>
        LatestSubscriptionPerStudio().CountAsync(s => s.EndDate >= asOf && s.EndDate < before, ct);

    public Task<decimal> SumRevenueAsync(DateTime? since, CancellationToken ct = default)
    {
        var query = context.SubscriptionPayments.AsQueryable();
        if (since is not null)
        {
            query = query.Where(p => p.PaymentDate >= since);
        }
        return query.SumAsync(p => (decimal?)p.Amount, ct).ContinueWith(t => t.Result ?? 0m, ct);
    }

    public async Task<List<PlanDistributionRow>> GetPlanDistributionAsync(CancellationToken ct = default)
    {
        var rows = await LatestSubscriptionPerStudio()
            .GroupBy(s => s.SubscriptionPlan.PlanName)
            .Select(g => new { PlanName = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return rows.Select(r => new PlanDistributionRow(r.PlanName, r.Count)).ToList();
    }
}
