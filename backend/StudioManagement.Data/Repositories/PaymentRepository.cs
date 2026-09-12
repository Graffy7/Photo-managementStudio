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

    public async Task AddAsync(Payment payment, CancellationToken ct = default) =>
        await context.Payments.AddAsync(payment, ct);

    public void Update(Payment payment) => context.Payments.Update(payment);
}
