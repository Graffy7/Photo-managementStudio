using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Billing;

public record LedgerEntry(
    int StudioId, SubscriptionPlan Plan, int Months, decimal Amount, DateTime PaymentDate,
    string PaymentMethod, string? ReferenceNumber, string? Notes);

public interface ISubscriptionLedger
{
    // Records a subscription payment and, when it buys months, extends the studio's access:
    //  - a paid plan still running: the months are added onto its current expiry (no days lost);
    //  - lapsed, never subscribed, or on a trial: a paid subscription starts now (a running trial ends).
    // Months are calendar months, so expiry is exact (31 Jan + 1 month = end of Feb).
    // Returns the payment row (saved).
    Task<SubscriptionPayment> RecordAsync(LedgerEntry entry, CancellationToken ct = default);
}

public class SubscriptionLedger(
    IStudioSubscriptionRepository subscriptionRepository,
    ISubscriptionPaymentRepository paymentRepository,
    IStudioAccessService accessService,
    IUnitOfWork unitOfWork) : ISubscriptionLedger
{
    public async Task<SubscriptionPayment> RecordAsync(LedgerEntry e, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var current = await subscriptionRepository.GetCurrentAsync(e.StudioId, ct);
        StudioSubscription target;
        DateTime? periodStart = null, periodEnd = null;

        if (e.Months > 0)
        {
            var running = current is not null && current.Status != SubscriptionStatuses.Cancelled && current.EndDate > now;
            if (current is null || current.IsTrial || current.Status == SubscriptionStatuses.Cancelled)
            {
                if (current is not null && current.IsTrial && running)
                {
                    current.EndDate = now;
                    current.Status = SubscriptionStatuses.Expired;
                    current.UpdatedAt = now;
                    subscriptionRepository.Update(current);
                }

                target = new StudioSubscription
                {
                    StudioId = e.StudioId,
                    SubscriptionPlanId = e.Plan.SubscriptionPlanId,
                    StartDate = now,
                    EndDate = now.AddMonths(e.Months),
                    Amount = e.Amount,
                    Status = SubscriptionStatuses.Active,
                    IsTrial = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await subscriptionRepository.AddAsync(target, ct);
                periodStart = target.StartDate;
                periodEnd = target.EndDate;
            }
            else
            {
                target = current;
                periodStart = running ? current.EndDate : now;
                periodEnd = periodStart.Value.AddMonths(e.Months);
                if (!running) current.StartDate = now;
                current.EndDate = periodEnd.Value;
                current.SubscriptionPlanId = e.Plan.SubscriptionPlanId;
                current.Amount = e.Amount;
                current.Status = SubscriptionStatuses.Active;
                current.UpdatedAt = now;
                subscriptionRepository.Update(current);
            }
        }
        else
        {
            target = current ?? throw new InvalidOperationException("No subscription to record a payment against.");
        }

        var payment = new SubscriptionPayment
        {
            StudioSubscription = target,
            Amount = e.Amount,
            PaymentDate = e.PaymentDate,
            PaymentMethod = e.PaymentMethod,
            ReferenceNumber = string.IsNullOrWhiteSpace(e.ReferenceNumber) ? null : e.ReferenceNumber.Trim(),
            Notes = string.IsNullOrWhiteSpace(e.Notes) ? null : e.Notes.Trim(),
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            CreatedAt = now
        };
        await paymentRepository.AddAsync(payment, ct);
        await unitOfWork.SaveChangesAsync(ct);

        accessService.Invalidate(e.StudioId);
        return payment;
    }
}
