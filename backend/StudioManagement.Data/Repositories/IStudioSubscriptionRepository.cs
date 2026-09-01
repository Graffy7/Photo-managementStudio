using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IStudioSubscriptionRepository : IRepository<StudioSubscription>
{
    Task<StudioSubscription?> GetCurrentAsync(int studioId, CancellationToken ct = default);
}
