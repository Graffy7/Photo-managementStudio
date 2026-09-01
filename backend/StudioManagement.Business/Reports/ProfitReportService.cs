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
                CashProfit = e.CollectedRevenue - e.Expenses
            }).ToList(),

            ExpensesByCategory = categoryRows.Select(c => new ExpenseCategoryBreakdownDto
            {
                CategoryName = c.CategoryName,
                TotalAmount = c.TotalAmount
            }).ToList()
        };
    }
}
