namespace StudioManagement.Data.Repositories;

public record PlanDistributionRow(string PlanName, int StudioCount);

public interface IDashboardRepository
{
    Task<int> CountTotalStudiosAsync(CancellationToken ct = default);
    Task<int> CountActiveStudiosAsync(CancellationToken ct = default);
    Task<int> CountBlockedStudiosAsync(CancellationToken ct = default);
    Task<int> CountNewStudiosSinceAsync(DateTime since, CancellationToken ct = default);
    Task<int> CountExpiredSubscriptionsAsync(DateTime asOf, CancellationToken ct = default);
    Task<int> CountExpiringSoonAsync(DateTime asOf, DateTime before, CancellationToken ct = default);
    Task<decimal> SumRevenueAsync(DateTime? since, CancellationToken ct = default);
    Task<List<PlanDistributionRow>> GetPlanDistributionAsync(CancellationToken ct = default);
}
