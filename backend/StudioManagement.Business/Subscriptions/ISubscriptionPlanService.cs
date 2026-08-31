namespace StudioManagement.Business.Subscriptions;

public interface ISubscriptionPlanService
{
    Task<List<SubscriptionPlanDto>> GetActivePlansAsync(CancellationToken ct = default);
}
