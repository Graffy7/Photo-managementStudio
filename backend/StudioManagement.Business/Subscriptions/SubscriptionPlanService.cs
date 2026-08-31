using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Subscriptions;

public class SubscriptionPlanService(IRepository<SubscriptionPlan> subscriptionPlanRepository) : ISubscriptionPlanService
{
    public async Task<List<SubscriptionPlanDto>> GetActivePlansAsync(CancellationToken ct = default)
    {
        var plans = await subscriptionPlanRepository.GetAllAsync(ct);
        return plans
            .Where(p => p.IsActive)
            .OrderBy(p => p.DurationInDays)
            .Select(p => new SubscriptionPlanDto
            {
                SubscriptionPlanId = p.SubscriptionPlanId,
                PlanName = p.PlanName,
                PlanType = p.PlanType,
                Price = p.Price,
                DurationInDays = p.DurationInDays
            })
            .ToList();
    }
}
