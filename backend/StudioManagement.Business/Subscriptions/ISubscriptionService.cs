using StudioManagement.Business.Studios;

namespace StudioManagement.Business.Subscriptions;

public interface ISubscriptionService
{
    Task<StudioDto?> RenewAsync(int studioId, RenewSubscriptionRequestDto request, CancellationToken ct = default);
    Task<List<SubscriptionPaymentDto>?> GetPaymentHistoryAsync(int studioId, CancellationToken ct = default);
}
