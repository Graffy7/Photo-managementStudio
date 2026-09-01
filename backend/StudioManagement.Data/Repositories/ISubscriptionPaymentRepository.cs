using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface ISubscriptionPaymentRepository : IRepository<SubscriptionPayment>
{
    Task<List<SubscriptionPayment>> GetByStudioSubscriptionIdAsync(int studioSubscriptionId, CancellationToken ct = default);
}
