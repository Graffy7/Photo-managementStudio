using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;

namespace StudioManagement.Data.Repositories;

public class StudioDashboardRepository(AppDbContext context) : IStudioDashboardRepository
{
    public Task<int> CountLeadsAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Leads.CountAsync(l => l.StudioId == studioId && l.CreatedAt >= start && l.CreatedAt < end, ct);

    public Task<int> CountConvertedLeadsAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Leads.CountAsync(l => l.StudioId == studioId && l.CreatedAt >= start && l.CreatedAt < end && l.ConvertedCustomerId != null, ct);

    public Task<int> CountTotalCustomersAsync(int studioId, CancellationToken ct = default) =>
        context.Customers.CountAsync(c => c.StudioId == studioId, ct);

    public Task<int> CountEventsByStatusAsync(int studioId, DateTime start, DateTime end, string? status, CancellationToken ct = default) =>
        context.Events.CountAsync(e =>
            e.StudioId == studioId && e.EventDate >= start && e.EventDate < end && (status == null || e.EventStatus == status), ct);

    public Task<decimal> SumAcceptedQuotationValueAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Quotations
            .Where(q => q.StudioId == studioId && q.QuotationDate >= start && q.QuotationDate < end && q.Status == QuotationStatuses.Accepted)
            .SumAsync(q => (decimal?)q.GrandTotal, ct)
            .ContinueWith(t => t.Result ?? 0m, ct);

    public Task<decimal> SumCollectedRevenueAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Payments
            .Where(p => p.StudioId == studioId && p.PaymentDate >= start && p.PaymentDate < end && p.PaymentStatus == PaymentStatuses.Completed)
            .SumAsync(p => (decimal?)p.Amount, ct)
            .ContinueWith(t => t.Result ?? 0m, ct);

    public Task<decimal> SumExpensesAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Expenses
            .Where(e => e.StudioId == studioId && e.ExpenseDate >= start && e.ExpenseDate < end)
            .SumAsync(e => (decimal?)e.Amount, ct)
            .ContinueWith(t => t.Result ?? 0m, ct);

    public Task<int> CountNewCustomersAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Customers.CountAsync(c => c.StudioId == studioId && c.CreatedAt >= start && c.CreatedAt < end, ct);

    public async Task<List<(string ServiceName, int Count)>> GetTopServicesAsync(int studioId, DateTime start, DateTime end, int take, CancellationToken ct = default)
    {
        var results = await context.QuotationItems
            .Where(qi => qi.Quotation.StudioId == studioId && qi.Quotation.QuotationDate >= start && qi.Quotation.QuotationDate < end)
            .GroupBy(qi => qi.Service.ServiceName)
            .Select(g => new { ServiceName = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(take)
            .ToListAsync(ct);

        return results.Select(r => (r.ServiceName, r.Count)).ToList();
    }

    public async Task<List<(DateTime Date, decimal Amount)>> GetDailyRevenueAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default)
    {
        var results = await context.Payments
            .Where(p => p.StudioId == studioId && p.PaymentDate >= start && p.PaymentDate < end && p.PaymentStatus == PaymentStatuses.Completed)
            .GroupBy(p => p.PaymentDate.Date)
            .Select(g => new { Date = g.Key, Amount = g.Sum(p => p.Amount) })
            .OrderBy(g => g.Date)
            .ToListAsync(ct);

        return results.Select(r => (r.Date, r.Amount)).ToList();
    }
}
