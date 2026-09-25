using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PaymentRepository(AppDbContext context) : IPaymentRepository
{
    public Task<Payment?> GetByIdAsync(int studioId, int paymentId, CancellationToken ct = default) =>
        context.Payments
            .Include(p => p.Customer)
            .Include(p => p.Event)
            .FirstOrDefaultAsync(p => p.StudioId == studioId && p.PaymentId == paymentId, ct);

    public async Task<(List<Payment> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? paymentStatus, int? customerId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Payments
            .AsNoTracking()
            .Include(p => p.Customer)
            .Include(p => p.Event)
            .Where(p => p.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Customer.FullName.Contains(term) || (p.ReferenceNumber != null && p.ReferenceNumber.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(paymentStatus))
        {
            query = query.Where(p => p.PaymentStatus == paymentStatus);
        }

        if (customerId is not null)
        {
            query = query.Where(p => p.CustomerId == customerId);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(p => p.PaymentDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<List<Payment>> GetForEventAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.Payments
            .AsNoTracking()
            .Where(p => p.StudioId == studioId && p.EventId == eventId)
            .OrderBy(p => p.PaymentDate).ThenBy(p => p.PaymentId)
            .ToListAsync(ct);

    public async Task<List<(int EventId, decimal TotalPaid)>> GetCompletedTotalsByEventIdsAsync(int studioId, List<int> eventIds, CancellationToken ct = default)
    {
        if (eventIds.Count == 0)
        {
            return [];
        }

        var results = await context.Payments
            .AsNoTracking()
            .Where(p => p.StudioId == studioId && p.EventId != null && eventIds.Contains(p.EventId.Value) && p.PaymentStatus == PaymentStatuses.Completed)
            .GroupBy(p => p.EventId!.Value)
            .Select(g => new { EventId = g.Key, TotalPaid = g.Sum(p => p.Amount) })
            .ToListAsync(ct);

        return results.Select(r => (r.EventId, r.TotalPaid)).ToList();
    }

    public async Task<decimal> GetCompletedTotalForEventAsync(int studioId, int eventId, int? excludePaymentId, CancellationToken ct = default) =>
        await context.Payments.AsNoTracking()
            .Where(p => p.StudioId == studioId && p.EventId == eventId && p.PaymentStatus == PaymentStatuses.Completed
                        && (excludePaymentId == null || p.PaymentId != excludePaymentId))
            .SumAsync(p => (decimal?)p.Amount, ct) ?? 0;

    public async Task<decimal> GetCompletedTotalForCustomerAsync(int studioId, int customerId, int? excludePaymentId, CancellationToken ct = default) =>
        await context.Payments.AsNoTracking()
            .Where(p => p.StudioId == studioId && p.CustomerId == customerId && p.PaymentStatus == PaymentStatuses.Completed
                        && (excludePaymentId == null || p.PaymentId != excludePaymentId))
            .SumAsync(p => (decimal?)p.Amount, ct) ?? 0;

    public async Task LockForPaymentAsync(int studioId, int customerId, int? eventId, CancellationToken ct = default)
    {
        if (eventId is not null)
        {
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT EventId FROM Events WITH (UPDLOCK, HOLDLOCK) WHERE EventId = {eventId} AND StudioId = {studioId}", ct);
        }
        else
        {
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT CustomerId FROM Customers WITH (UPDLOCK, HOLDLOCK) WHERE CustomerId = {customerId} AND StudioId = {studioId}", ct);
        }
    }

    public async Task AddAsync(Payment payment, CancellationToken ct = default) =>
        await context.Payments.AddAsync(payment, ct);

    public void Update(Payment payment) => context.Payments.Update(payment);
}
