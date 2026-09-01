using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Dashboard;

public class DashboardService(IDashboardRepository dashboardRepository, IUnitOfWork unitOfWork) : IDashboardService
{
    private static readonly TimeSpan ExpiringSoonWindow = TimeSpan.FromDays(7);

    public Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        // Every count/sum below must reflect the exact same moment in time, or a write that lands
        // mid-sequence can make some numbers reflect the old state and others the new one — hence
        // the snapshot transaction wrapping the whole sequential read below, rather than each call
        // reading independently under the database's default read-committed-snapshot behavior.
        return unitOfWork.ExecuteInSnapshotAsync(BuildSummaryAsync, ct);
    }

    private async Task<DashboardSummaryDto> BuildSummaryAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // Sequential, not parallel — these all share one scoped DbContext, which EF Core does not
        // allow to run concurrent operations against.
        var totalStudios = await dashboardRepository.CountTotalStudiosAsync(ct);
        var activeStudios = await dashboardRepository.CountActiveStudiosAsync(ct);
        var blockedStudios = await dashboardRepository.CountBlockedStudiosAsync(ct);
        var newStudiosThisMonth = await dashboardRepository.CountNewStudiosSinceAsync(startOfMonth, ct);
        var expiredSubscriptions = await dashboardRepository.CountExpiredSubscriptionsAsync(now, ct);
        var expiringSoon = await dashboardRepository.CountExpiringSoonAsync(now, now.Add(ExpiringSoonWindow), ct);
        var totalRevenue = await dashboardRepository.SumRevenueAsync(null, ct);
        var revenueThisMonth = await dashboardRepository.SumRevenueAsync(startOfMonth, ct);
        var planDistribution = await dashboardRepository.GetPlanDistributionAsync(ct);

        return new DashboardSummaryDto
        {
            TotalStudios = totalStudios,
            ActiveStudios = activeStudios,
            BlockedStudios = blockedStudios,
            NewStudiosThisMonth = newStudiosThisMonth,
            ExpiredSubscriptions = expiredSubscriptions,
            ExpiringSoon = expiringSoon,
            TotalRevenue = totalRevenue,
            RevenueThisMonth = revenueThisMonth,
            PlanDistribution = planDistribution.Select(p => new PlanDistributionDto { PlanName = p.PlanName, StudioCount = p.StudioCount }).ToList()
        };
    }
}
