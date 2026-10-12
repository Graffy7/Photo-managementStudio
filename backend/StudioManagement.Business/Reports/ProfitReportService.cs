using StudioManagement.Business.Common;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Reports;

public class ProfitReportService(
    IProfitReportRepository profitReportRepository,
    IStudioDashboardRepository dashboardRepository,
    IUnitOfWork unitOfWork) : IProfitReportService
{
    public Task<ProfitReportDto> GetProfitReportAsync(int studioId, DateRangePreset preset, DateTime? customStart, DateTime? customEnd, CancellationToken ct = default)
    {
        var range = DateRange.Resolve(preset, customStart, customEnd);

        // Same reasoning as the dashboard summaries: several separate queries feeding one report
        // must all see the same instant, so the whole read runs inside one snapshot transaction.
        return unitOfWork.ExecuteInSnapshotAsync(ct => BuildReportAsync(studioId, range, ct), ct);
    }

    private async Task<ProfitReportDto> BuildReportAsync(int studioId, DateRange range, CancellationToken ct)
    {
        var totalQuotationValue = await dashboardRepository.SumAcceptedQuotationValueAsync(studioId, range.Start, range.End, ct);
        var totalCollectedRevenue = await dashboardRepository.SumCollectedRevenueAsync(studioId, range.Start, range.End, ct);
        var totalExpenses = await dashboardRepository.SumExpensesAsync(studioId, range.Start, range.End, ct);

        var eventRows = await profitReportRepository.GetEventBreakdownAsync(studioId, range.Start, range.End, ct);
        var categoryRows = await profitReportRepository.GetExpenseBreakdownByCategoryAsync(studioId, range.Start, range.End, ct);

        return new ProfitReportDto
        {
            RangeStart = range.Start,
            RangeEnd = range.End,

            TotalQuotationValue = totalQuotationValue,
            TotalCollectedRevenue = totalCollectedRevenue,
            TotalExpenses = totalExpenses,
            TotalExpectedProfit = totalQuotationValue - totalExpenses,
            TotalCashProfit = totalCollectedRevenue - totalExpenses,

            EventsTotalAmount = eventRows.Sum(e => e.EventTotal),
            EventsExpenses = eventRows.Sum(e => e.Expenses),
            EventsPendingExpenses = eventRows.Sum(e => e.PendingExpenses),
            EventsNetProfit = eventRows.Sum(e => e.EventTotal - e.Expenses),
            EventsOutstandingBalance = eventRows.Sum(e => e.EventTotal - e.CollectedRevenue),

            Events = eventRows.Select(e => new EventProfitDto
            {
                EventId = e.EventId,
                EventDate = e.EventDate,
                Venue = e.Venue,
                CustomerName = e.CustomerName,
                QuotationValue = e.QuotationValue,
                CollectedRevenue = e.CollectedRevenue,
                Expenses = e.Expenses,
                ExpectedProfit = e.QuotationValue - e.Expenses,
                CashProfit = e.CollectedRevenue - e.Expenses,
                EventTotal = e.EventTotal,
                PaidExpenses = e.Expenses - e.PendingExpenses,
                PendingExpenses = e.PendingExpenses,
                NetProfit = e.EventTotal - e.Expenses,
                ProfitMarginPercent = EventProfitMath.MarginPercent(e.EventTotal, e.Expenses),
                OutstandingBalance = e.EventTotal - e.CollectedRevenue
            }).ToList(),

            ExpensesByCategory = categoryRows.Select(c => new ExpenseCategoryBreakdownDto
            {
                CategoryName = c.CategoryName,
                TotalAmount = c.TotalAmount
            }).ToList()
        };
    }
}

// One definition of the profit margin, shared by the report and the event's own expense summary.
public static class EventProfitMath
{
    // (total - expenses) / total as a percentage, one decimal; null when there is no total.
    public static decimal? MarginPercent(decimal eventTotal, decimal expenses) =>
        eventTotal > 0 ? Math.Round((eventTotal - expenses) / eventTotal * 100m, 1) : null;
}
