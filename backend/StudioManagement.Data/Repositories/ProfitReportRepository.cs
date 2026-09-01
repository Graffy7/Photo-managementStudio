using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;

namespace StudioManagement.Data.Repositories;

public class ProfitReportRepository(AppDbContext context) : IProfitReportRepository
{
    public Task<List<EventProfitRow>> GetEventBreakdownAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Events
            .AsNoTracking()
            .Where(e => e.StudioId == studioId && e.EventDate >= start && e.EventDate < end)
            .OrderBy(e => e.EventDate)
            .Select(e => new EventProfitRow
            {
                EventId = e.EventId,
                EventDate = e.EventDate,
                Venue = e.Venue,
                CustomerName = e.Customer.FullName,
                QuotationValue = e.Quotations
                    .Where(q => q.Status == QuotationStatuses.Accepted)
                    .Sum(q => (decimal?)q.GrandTotal) ?? 0m,
                CollectedRevenue = e.Payments
                    .Where(p => p.PaymentStatus == PaymentStatuses.Completed)
                    .Sum(p => (decimal?)p.Amount) ?? 0m,
                Expenses = e.Expenses.Sum(ex => (decimal?)ex.Amount) ?? 0m
            })
            .ToListAsync(ct);

    public Task<List<ExpenseCategoryBreakdownRow>> GetExpenseBreakdownByCategoryAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Expenses
            .AsNoTracking()
            .Where(e => e.StudioId == studioId && e.ExpenseDate >= start && e.ExpenseDate < end)
            .GroupBy(e => e.ExpenseCategory.CategoryName)
            .Select(g => new ExpenseCategoryBreakdownRow
            {
                CategoryName = g.Key,
                TotalAmount = g.Sum(e => e.Amount)
            })
            .OrderByDescending(g => g.TotalAmount)
            .ToListAsync(ct);
}
