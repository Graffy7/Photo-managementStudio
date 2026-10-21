using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;

namespace StudioManagement.Data.Repositories;

// One event dated in the report range, with what has been received for it so far.
public class AnalyticsEventRow
{
    public int EventId { get; set; }
    public DateTime EventDate { get; set; }
    public string Status { get; set; } = null!;
    public decimal Value { get; set; }
    public string? EventTypeName { get; set; }
    public decimal Received { get; set; }
}

public class AnalyticsMoneyRow
{
    public DateTime Date { get; set; }
    public decimal Amount { get; set; }
    public string? Category { get; set; }
}

public interface IAnalyticsReportRepository
{
    // Events whose date falls in [start, end).
    Task<List<AnalyticsEventRow>> GetEventsDatedAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    // When each event booked in [startUtc, endUtc) was created (UTC).
    Task<List<DateTime>> GetBookingTimesAsync(int studioId, DateTime startUtc, DateTime endUtc, CancellationToken ct = default);
    // Received payments dated in [start, end).
    Task<List<AnalyticsMoneyRow>> GetPaymentsAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    // Expenses dated in [start, end), with their category.
    Task<List<AnalyticsMoneyRow>> GetExpensesAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
}

public class AnalyticsReportRepository(AppDbContext context) : IAnalyticsReportRepository
{
    public Task<List<AnalyticsEventRow>> GetEventsDatedAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Events
            .AsNoTracking()
            .Where(e => e.StudioId == studioId && e.EventDate >= start && e.EventDate < end)
            .Select(e => new AnalyticsEventRow
            {
                EventId = e.EventId,
                EventDate = e.EventDate,
                Status = e.EventStatus,
                Value = e.Budget ?? 0m,
                EventTypeName = e.EventType != null ? e.EventType.Name : null,
                Received = e.Payments
                    .Where(p => p.PaymentStatus == PaymentStatuses.Completed)
                    .Sum(p => (decimal?)p.Amount) ?? 0m
            })
            .ToListAsync(ct);

    public Task<List<DateTime>> GetBookingTimesAsync(int studioId, DateTime startUtc, DateTime endUtc, CancellationToken ct = default) =>
        context.Events
            .AsNoTracking()
            .Where(e => e.StudioId == studioId && e.CreatedAt >= startUtc && e.CreatedAt < endUtc)
            .Select(e => e.CreatedAt)
            .ToListAsync(ct);

    public Task<List<AnalyticsMoneyRow>> GetPaymentsAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Payments
            .AsNoTracking()
            .Where(p => p.StudioId == studioId && p.PaymentDate >= start && p.PaymentDate < end && p.PaymentStatus == PaymentStatuses.Completed)
            .Select(p => new AnalyticsMoneyRow { Date = p.PaymentDate, Amount = p.Amount })
            .ToListAsync(ct);

    public Task<List<AnalyticsMoneyRow>> GetExpensesAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default) =>
        context.Expenses
            .AsNoTracking()
            .Where(e => e.StudioId == studioId && e.ExpenseDate >= start && e.ExpenseDate < end)
            .Select(e => new AnalyticsMoneyRow { Date = e.ExpenseDate, Amount = e.Amount, Category = e.ExpenseCategory.CategoryName })
            .ToListAsync(ct);
}
