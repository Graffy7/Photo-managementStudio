using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public record OrderQuery(int? StudioId, string? Status, string? Search, DateTime? From, DateTime? To, int Page, int PageSize);

public interface ISubscriptionOrderRepository
{
    Task AddAsync(SubscriptionOrder order, CancellationToken ct = default);
    Task<SubscriptionOrder?> GetByGatewayOrderIdAsync(string gatewayOrderId, CancellationToken ct = default);

    // An unpaid order the studio opened for this plan in the last few minutes (a double click or a
    // closed checkout window reuses it instead of creating another).
    Task<SubscriptionOrder?> GetRecentOpenAsync(int studioId, int planId, DateTime since, CancellationToken ct = default);

    // Moves the order to Paid only if it isn't already - the database guarantees one winner when
    // the browser callback and the webhook arrive together. True for the caller that won.
    Task<bool> TryMarkPaidAsync(int orderId, string paymentId, string? method, DateTime now, CancellationToken ct = default);
    Task LinkPaymentAsync(int orderId, int subscriptionPaymentId, CancellationToken ct = default);
    Task<bool> MarkFailedAsync(int orderId, string? reason, string? paymentId, DateTime now, CancellationToken ct = default);

    Task<List<SubscriptionOrder>> GetForStudioAsync(int studioId, CancellationToken ct = default);
    Task<(List<SubscriptionOrder> Items, int Total)> SearchAsync(OrderQuery query, CancellationToken ct = default);

    // Records a webhook delivery; false when this event id was already recorded (a replay).
    Task<bool> TryRecordEventAsync(PaymentGatewayEvent evt, CancellationToken ct = default);
}

public class SubscriptionOrderRepository(AppDbContext context) : ISubscriptionOrderRepository
{
    public async Task AddAsync(SubscriptionOrder order, CancellationToken ct = default)
    {
        context.SubscriptionOrders.Add(order);
        await context.SaveChangesAsync(ct);
    }

    public Task<SubscriptionOrder?> GetByGatewayOrderIdAsync(string gatewayOrderId, CancellationToken ct = default) =>
        context.SubscriptionOrders.AsNoTracking().Include(o => o.SubscriptionPlan)
            .FirstOrDefaultAsync(o => o.GatewayOrderId == gatewayOrderId, ct);

    public Task<SubscriptionOrder?> GetRecentOpenAsync(int studioId, int planId, DateTime since, CancellationToken ct = default) =>
        context.SubscriptionOrders.AsNoTracking()
            .Where(o => o.StudioId == studioId && o.SubscriptionPlanId == planId && o.Status == PaymentOrderStatuses.Created && o.CreatedAt >= since)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<bool> TryMarkPaidAsync(int orderId, string paymentId, string? method, DateTime now, CancellationToken ct = default) =>
        await context.SubscriptionOrders
            .Where(o => o.SubscriptionOrderId == orderId && o.Status != PaymentOrderStatuses.Paid)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, PaymentOrderStatuses.Paid)
                .SetProperty(o => o.GatewayPaymentId, paymentId)
                .SetProperty(o => o.PaymentMethod, method)
                .SetProperty(o => o.FailureReason, (string?)null)
                .SetProperty(o => o.PaidAt, now)
                .SetProperty(o => o.UpdatedAt, now), ct) == 1;

    public Task LinkPaymentAsync(int orderId, int subscriptionPaymentId, CancellationToken ct = default) =>
        context.SubscriptionOrders.Where(o => o.SubscriptionOrderId == orderId)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.SubscriptionPaymentId, subscriptionPaymentId), ct);

    // A failure never overrides a payment that already succeeded (a later retry on the same order
    // can still succeed and move it to Paid).
    public async Task<bool> MarkFailedAsync(int orderId, string? reason, string? paymentId, DateTime now, CancellationToken ct = default) =>
        await context.SubscriptionOrders
            .Where(o => o.SubscriptionOrderId == orderId && o.Status == PaymentOrderStatuses.Created)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, PaymentOrderStatuses.Failed)
                .SetProperty(o => o.FailureReason, reason)
                .SetProperty(o => o.UpdatedAt, now), ct) == 1;

    public Task<List<SubscriptionOrder>> GetForStudioAsync(int studioId, CancellationToken ct = default) =>
        context.SubscriptionOrders.AsNoTracking().Include(o => o.SubscriptionPlan)
            .Where(o => o.StudioId == studioId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

    public async Task<(List<SubscriptionOrder> Items, int Total)> SearchAsync(OrderQuery q, CancellationToken ct = default)
    {
        var query = context.SubscriptionOrders.AsNoTracking().Include(o => o.SubscriptionPlan).Include(o => o.Studio).AsQueryable();
        if (q.StudioId is not null) query = query.Where(o => o.StudioId == q.StudioId);
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(o => o.Status == q.Status);
        if (q.From is not null) query = query.Where(o => o.CreatedAt >= q.From);
        if (q.To is not null) query = query.Where(o => o.CreatedAt < q.To);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var t = q.Search.Trim();
            query = query.Where(o => o.Studio.StudioName.Contains(t) || o.GatewayOrderId.Contains(t) || (o.GatewayPaymentId != null && o.GatewayPaymentId.Contains(t)));
        }

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(o => o.CreatedAt).Skip((q.Page - 1) * q.PageSize).Take(q.PageSize).ToListAsync(ct);
        return (items, total);
    }

    public async Task<bool> TryRecordEventAsync(PaymentGatewayEvent evt, CancellationToken ct = default)
    {
        if (await context.PaymentGatewayEvents.AnyAsync(e => e.Gateway == evt.Gateway && e.EventId == evt.EventId, ct))
        {
            return false;
        }

        context.PaymentGatewayEvents.Add(evt);
        try
        {
            await context.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException)
        {
            // Two deliveries of the same event at once: the unique index let only one in.
            context.Entry(evt).State = EntityState.Detached;
            return false;
        }
    }
}
