using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class SubscriptionPaymentRepository(AppDbContext context) : Repository<SubscriptionPayment>(context), ISubscriptionPaymentRepository
{
    public Task<List<SubscriptionPayment>> GetByStudioSubscriptionIdAsync(int studioSubscriptionId, CancellationToken ct = default) =>
        Set.AsNoTracking()
            .Where(p => p.StudioSubscriptionId == studioSubscriptionId)
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync(ct);
}
