using StudioManagement.Business.Common;
using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Dashboard;

public class StudioDashboardService(IStudioDashboardRepository repository, IUnitOfWork unitOfWork) : IStudioDashboardService
{
    public Task<StudioDashboardSummaryDto> GetSummaryAsync(int studioId, DateRangePreset preset, DateTime? customStart, DateTime? customEnd, CancellationToken ct = default)
    {
        var range = DateRange.Resolve(preset, customStart, customEnd);

        // Every count/sum below must reflect the exact same moment in time, or a write that lands
        // mid-sequence can make some numbers reflect the old state and others the new one — hence
        // the snapshot transaction wrapping the whole sequential read below, rather than each call
        // reading independently under the database's default read-committed-snapshot behavior.
        return unitOfWork.ExecuteInSnapshotAsync(ct => BuildSummaryAsync(studioId, range, ct), ct);
    }

    private async Task<StudioDashboardSummaryDto> BuildSummaryAsync(int studioId, DateRange range, CancellationToken ct)
    {
        var previous = range.Previous();

        // Sequential — these share one scoped DbContext, which EF Core does not allow to run
        // concurrent operations against.
        var totalLeads = await repository.CountLeadsAsync(studioId, range.Start, range.End, ct);
        var convertedLeads = await repository.CountConvertedLeadsAsync(studioId, range.Start, range.End, ct);
        var totalCustomers = await repository.CountTotalCustomersAsync(studioId, ct);
        var newCustomers = await repository.CountNewCustomersAsync(studioId, range.Start, range.End, ct);

        var totalEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, null, ct);
        var upcomingEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Upcoming, ct);
        var confirmedEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Confirmed, ct);
        var completedEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Completed, ct);
        var cancelledEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Cancelled, ct);

        var quotationValue = await repository.SumAcceptedQuotationValueAsync(studioId, range.Start, range.End, ct);
        var collectedRevenue = await repository.SumCollectedRevenueAsync(studioId, range.Start, range.End, ct);
        var totalExpenses = await repository.SumExpensesAsync(studioId, range.Start, range.End, ct);

        var topServices = await repository.GetTopServicesAsync(studioId, range.Start, range.End, 3, ct);
        var revenueTrend = await repository.GetDailyRevenueAsync(studioId, range.Start, range.End, ct);
        var revenueBreakdown = await repository.GetDailyRevenueBreakdownAsync(studioId, range.Start, range.End, ct);

        // Previous-period baselines, purely for the "vs last period" deltas above.
        var previousLeads = await repository.CountLeadsAsync(studioId, previous.Start, previous.End, ct);
        var previousNewCustomers = await repository.CountNewCustomersAsync(studioId, previous.Start, previous.End, ct);
        var previousEvents = await repository.CountEventsByStatusAsync(studioId, previous.Start, previous.End, null, ct);
        var previousRevenue = await repository.SumCollectedRevenueAsync(studioId, previous.Start, previous.End, ct);

        var totalServiceUsage = topServices.Sum(s => s.Count);

        return new StudioDashboardSummaryDto
        {
            RangeStart = range.Start,
            RangeEnd = range.End,

            TotalLeads = totalLeads,
            NewLeads = totalLeads - convertedLeads,
            ConvertedLeads = convertedLeads,
            ConversionRate = totalLeads == 0 ? 0m : Math.Round((decimal)convertedLeads / totalLeads * 100, 1),

            TotalCustomers = totalCustomers,

            TotalEvents = totalEvents,
            UpcomingEvents = upcomingEvents + confirmedEvents,
            CompletedEvents = completedEvents,
            CancelledEvents = cancelledEvents,

            QuotationValue = quotationValue,
            CollectedRevenue = collectedRevenue,
            OutstandingBalance = quotationValue - collectedRevenue,
            TotalExpenses = totalExpenses,
            ExpectedProfit = quotationValue - totalExpenses,
            CashProfit = collectedRevenue - totalExpenses,

            LeadsChangePercent = PercentChange(totalLeads, previousLeads),
            CustomersChangePercent = PercentChange(newCustomers, previousNewCustomers),
            EventsChangePercent = PercentChange(totalEvents, previousEvents),
            RevenueChangePercent = PercentChange(collectedRevenue, previousRevenue),

            TopServices = topServices.Select(s => new TopServiceDto
            {
                ServiceName = s.ServiceName,
                UsageCount = s.Count,
                Percentage = totalServiceUsage == 0 ? 0m : Math.Round((decimal)s.Count / totalServiceUsage * 100, 0)
            }).ToList(),

            RevenueTrend = revenueTrend.Select(r => new RevenueTrendPointDto
            {
                Date = r.Date,
                Amount = r.Amount,
                Events = revenueBreakdown
                    .Where(b => b.Date == r.Date)
                    .Select(b => new RevenueTrendEventDto
                    {
                        EventId = b.EventId,
                        EventName = b.EventId is null ? "Payment (no event)" : b.EventTypeName ?? "Event",
                        CustomerName = b.CustomerName,
                        Venue = b.Venue,
                        Amount = b.Amount
                    })
                    .ToList()
            }).ToList()
        };
    }

    // Null means there's no previous-period baseline to compare against, so a percentage would
    // be meaningless (or infinite) — the client shows "no comparison" rather than a fake number.
    private static decimal? PercentChange(decimal current, decimal previous)
    {
        if (previous == 0)
        {
            return current == 0 ? 0m : null;
        }

        return Math.Round((current - previous) / previous * 100, 1);
    }
}
