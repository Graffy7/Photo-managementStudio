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
        // Sequential — these share one scoped DbContext, which EF Core does not allow to run
        // concurrent operations against.
        var totalLeads = await repository.CountLeadsAsync(studioId, range.Start, range.End, ct);
        var convertedLeads = await repository.CountConvertedLeadsAsync(studioId, range.Start, range.End, ct);
        var totalCustomers = await repository.CountTotalCustomersAsync(studioId, ct);

        var totalEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, null, ct);
        var upcomingEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Upcoming, ct);
        var confirmedEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Confirmed, ct);
        var inProgressEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.InProgress, ct);
        var completedEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Completed, ct);
        var cancelledEvents = await repository.CountEventsByStatusAsync(studioId, range.Start, range.End, EventStatuses.Cancelled, ct);

        var quotationValue = await repository.SumAcceptedQuotationValueAsync(studioId, range.Start, range.End, ct);
        var collectedRevenue = await repository.SumCollectedRevenueAsync(studioId, range.Start, range.End, ct);
        var totalExpenses = await repository.SumExpensesAsync(studioId, range.Start, range.End, ct);

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
            UpcomingEvents = upcomingEvents + confirmedEvents + inProgressEvents,
            CompletedEvents = completedEvents,
            CancelledEvents = cancelledEvents,

            QuotationValue = quotationValue,
            CollectedRevenue = collectedRevenue,
            OutstandingBalance = quotationValue - collectedRevenue,
            TotalExpenses = totalExpenses,
            ExpectedProfit = quotationValue - totalExpenses,
            CashProfit = collectedRevenue - totalExpenses
        };
    }
}
