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
    Task<List<DailyRevenueItem>> GetDailyRevenueBreakdownAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
}

// One day's collected revenue from one event (or, when a payment wasn't linked to an event, from one
// customer) — what the revenue chart's tooltip lists under each day.
public record DailyRevenueItem(DateTime Date, int? EventId, string? EventTypeName, string CustomerName, string? Venue, decimal Amount);
