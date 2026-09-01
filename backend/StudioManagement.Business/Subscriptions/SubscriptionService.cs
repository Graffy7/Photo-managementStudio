using StudioManagement.Business.Audit;
using StudioManagement.Business.Studios;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Subscriptions;

public class SubscriptionService(
    IStudioSubscriptionRepository studioSubscriptionRepository,
    ISubscriptionPaymentRepository subscriptionPaymentRepository,
    IRepository<SubscriptionPlan> subscriptionPlanRepository,
    IStudioService studioService,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : ISubscriptionService
{
    public async Task<StudioDto?> RenewAsync(int studioId, RenewSubscriptionRequestDto request, CancellationToken ct = default)
    {
        var current = await studioSubscriptionRepository.GetCurrentAsync(studioId, ct);
        if (current is null)
        {
            return null;
        }

        var plan = request.SubscriptionPlanId is { } planId
            ? await subscriptionPlanRepository.GetByIdAsync(planId, ct)
            : current.SubscriptionPlan;
        if (plan is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var renewalStart = current.EndDate > now ? current.EndDate : now;

        current.SubscriptionPlanId = plan.SubscriptionPlanId;
        current.Amount = plan.Price;
        current.EndDate = renewalStart.AddDays(plan.DurationInDays);
        current.Status = SubscriptionStatuses.Active;
        current.UpdatedAt = now;
        studioSubscriptionRepository.Update(current);

        await subscriptionPaymentRepository.AddAsync(new SubscriptionPayment
        {
            StudioSubscriptionId = current.StudioSubscriptionId,
            Amount = plan.Price,
            PaymentDate = now,
            PaymentMethod = request.PaymentMethod,
            ReferenceNumber = request.ReferenceNumber,
            Notes = request.Notes,
            CreatedAt = now
        }, ct);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Subscription renewed ({plan.PlanName})", "Subscriptions", studioId, ct);

        return await studioService.GetByIdAsync(studioId, ct);
    }

    public async Task<List<SubscriptionPaymentDto>?> GetPaymentHistoryAsync(int studioId, CancellationToken ct = default)
    {
        var current = await studioSubscriptionRepository.GetCurrentAsync(studioId, ct);
        if (current is null)
        {
            return null;
        }

        var payments = await subscriptionPaymentRepository.GetByStudioSubscriptionIdAsync(current.StudioSubscriptionId, ct);
        return payments.Select(p => new SubscriptionPaymentDto
        {
            SubscriptionPaymentId = p.SubscriptionPaymentId,
            Amount = p.Amount,
            PaymentDate = p.PaymentDate,
            PaymentMethod = p.PaymentMethod,
            ReferenceNumber = p.ReferenceNumber,
            Notes = p.Notes
        }).ToList();
    }
}
