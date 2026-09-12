namespace StudioManagement.Data.Repositories;

public interface IStudioDashboardRepository
{
    Task<int> CountLeadsAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<int> CountConvertedLeadsAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<int> CountTotalCustomersAsync(int studioId, CancellationToken ct = default);
    Task<int> CountEventsByStatusAsync(int studioId, DateTime start, DateTime end, string? status, CancellationToken ct = default);
    Task<decimal> SumAcceptedQuotationValueAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<decimal> SumCollectedRevenueAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<decimal> SumExpensesAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<int> CountNewCustomersAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<List<(string ServiceName, int Count)>> GetTopServicesAsync(int studioId, DateTime start, DateTime end, int take, CancellationToken ct = default);
    Task<List<(DateTime Date, decimal Amount)>> GetDailyRevenueAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
}
