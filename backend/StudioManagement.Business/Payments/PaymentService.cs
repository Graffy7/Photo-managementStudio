using Microsoft.Extensions.Configuration;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Business.Notifications;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Payments;

public class PaymentService(
    IPaymentRepository paymentRepository,
    ICustomerRepository customerRepository,
    IEventRepository eventRepository,
    IAuditService auditService,
    INotificationService notificationService,
    IConfiguration configuration,
    IUnitOfWork unitOfWork) : IPaymentService
{
    private const string Module = "Payments";

    // A single entry above this is almost certainly a typo (an extra zero or two).
    private decimal MaxAmount => configuration.GetValue<decimal?>("Payments:MaxAmount") ?? 10_000_000m;

    private static string Rupees(decimal value) => $"₹{value:N0}";

    // The money rules, checked on the server against the stored figures (never the form's own sums):
    //  - a payment (positive) can't be more than what's still due on the event;
    //  - a deduction/refund (negative) needs a reason and can't be more than what's been paid;
    //  - no single entry above Payments:MaxAmount, and at most 2 decimal places.
    // Cancelled entries don't count towards anything, so only the size limits apply to them.
    // Dates: money marked Completed has been received, so it can't be dated after today (the
    // studio's clock, with one day of slack for time zones). A payment that's only expected can be
    // saved as Pending with a date up to a year ahead. Any real past date still works.
    private static string? CheckDate(DateTime paymentDate, string status)
    {
        var today = DateTime.Now.Date;
        if (paymentDate.Date < new DateTime(2000, 1, 1))
        {
            return "Check the payment date - it's too far in the past.";
        }
        if (status == PaymentStatuses.Completed && paymentDate.Date > today.AddDays(1))
        {
            return $"A received payment can't be dated in the future ({paymentDate:dd MMM yyyy}). If the money is only expected, save it as Pending.";
        }
        if (paymentDate.Date > today.AddYears(1))
        {
            return "Payment dates can be at most a year ahead.";
        }
        return null;
    }

    private async Task<string?> CheckAmountAsync(int studioId, int customerId, int? eventId, decimal amount, string status,
        string? notes, int? excludePaymentId, CancellationToken ct)
    {
        if (decimal.Round(amount, 2) != amount)
        {
            return "Amounts can have at most 2 decimal places.";
        }
        if (Math.Abs(amount) > MaxAmount)
        {
            return $"That amount looks too large — one entry can be at most {Rupees(MaxAmount)}. Check for an extra zero.";
        }
        if (amount < 0 && (notes ?? "").Trim().Length < 3)
        {
            return "Give a reason for the deduction in Notes (for example: refund for a cancelled album).";
        }
        if (status == PaymentStatuses.Cancelled)
        {
            return null;
        }

        if (eventId is not null)
        {
            var evt = await eventRepository.GetByIdAsync(studioId, eventId.Value, ct);
            var paid = await paymentRepository.GetCompletedTotalForEventAsync(studioId, eventId.Value, excludePaymentId, ct);
            if (amount > 0 && evt?.Budget is > 0)
            {
                var due = Math.Max(0, evt.Budget.Value - paid);
                if (amount > due)
                {
                    return due == 0
                        ? $"This event is already fully paid ({Rupees(paid)} of {Rupees(evt.Budget.Value)}). Update the event's total first if more is owed."
                        : $"That's {Rupees(amount - due)} more than the {Rupees(due)} still due on this event. Update the event's total first if more is owed.";
                }
            }
            if (amount < 0 && -amount > paid)
            {
                return $"A deduction can't be more than what's been paid for this event so far ({Rupees(Math.Max(0, paid))}).";
            }
            return null;
        }

        if (amount < 0)
        {
            var paid = await paymentRepository.GetCompletedTotalForCustomerAsync(studioId, customerId, excludePaymentId, ct);
            if (-amount > paid)
            {
                return $"A deduction can't be more than what this customer has paid so far ({Rupees(Math.Max(0, paid))}).";
            }
        }
        return null;
    }

    public async Task<PagedResult<PaymentDto>> SearchAsync(int studioId, string? search, string? paymentStatus, int? customerId, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await paymentRepository.SearchAsync(studioId, search, paymentStatus, customerId, page, pageSize, ct);
        var eventTotals = await GetEventTotalsAsync(studioId, items, ct);
        return new PagedResult<PaymentDto>
        {
            Items = items.Select(p => MapToDto(p, eventTotals)).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PaymentDto?> GetByIdAsync(int studioId, int paymentId, CancellationToken ct = default)
    {
        var payment = await paymentRepository.GetByIdAsync(studioId, paymentId, ct);
        if (payment is null)
        {
            return null;
        }

        var eventTotals = await GetEventTotalsAsync(studioId, [payment], ct);
        return MapToDto(payment, eventTotals);
    }

    // "Advance paid" needs every Completed payment recorded against an event, not just the one
    // row being mapped — Event.Payments can't be Include()'d for this (it cycles back through
    // this same entity in a no-tracking query), so it's fetched as a separate grouped lookup.
    private async Task<Dictionary<int, decimal>> GetEventTotalsAsync(int studioId, List<Payment> payments, CancellationToken ct)
    {
        var eventIds = payments.Where(p => p.EventId is not null).Select(p => p.EventId!.Value).Distinct().ToList();
        var totals = await paymentRepository.GetCompletedTotalsByEventIdsAsync(studioId, eventIds, ct);
        return totals.ToDictionary(t => t.EventId, t => t.TotalPaid);
    }

    public async Task<PaymentWriteResult> CreateAsync(int studioId, CreatePaymentRequestDto request, CancellationToken ct = default)
    {
        var failure = await ValidateReferencesAsync(studioId, request.CustomerId, request.EventId, ct);
        if (failure is not null)
        {
            return PaymentWriteResult.Fail(failure.Value);
        }

        // Checked and written under a lock on the event, so the balance can't change in between.
        var (payment, problem) = await unitOfWork.ExecuteInTransactionAsync(async tx =>
        {
            await paymentRepository.LockForPaymentAsync(studioId, request.CustomerId, request.EventId, tx);
            var amountProblem = CheckDate(request.PaymentDate, request.PaymentStatus)
                ?? await CheckAmountAsync(studioId, request.CustomerId, request.EventId, request.Amount,
                    request.PaymentStatus, request.Notes, excludePaymentId: null, tx);
            if (amountProblem is not null)
            {
                return ((Payment?)null, amountProblem);
            }

            var now = DateTime.UtcNow;
            var added = new Payment
            {
                StudioId = studioId,
                CustomerId = request.CustomerId,
                EventId = request.EventId,
                Amount = request.Amount,
                PaymentDate = request.PaymentDate,
                PaymentMethod = request.PaymentMethod,
                ReferenceNumber = request.ReferenceNumber,
                Notes = request.Notes,
                PaymentStatus = request.PaymentStatus,
                CreatedAt = now,
                UpdatedAt = now
            };
            await paymentRepository.AddAsync(added, tx);
            await unitOfWork.SaveChangesAsync(tx);
            return ((Payment?)added, (string?)null);
        }, ct);
        if (problem is not null)
        {
            return PaymentWriteResult.Fail(PaymentWriteFailureReason.AmountNotAllowed, problem);
        }

        await auditService.LogAsync("Payment recorded", Module, studioId, ct);

        var created = await paymentRepository.GetByIdAsync(studioId, payment!.PaymentId, ct);
        var eventTotals = await GetEventTotalsAsync(studioId, [created!], ct);
        var dto = MapToDto(created!, eventTotals);

        if (payment.PaymentStatus == PaymentStatuses.Completed)
        {
            var isDeduction = payment.Amount < 0;
            var title = isDeduction ? "Payment deducted" : "Payment received";
            var message = isDeduction
                ? $"₹{Math.Abs(payment.Amount):N0} deducted from {dto.CustomerName}'s payments"
                : $"Payment received: ₹{payment.Amount:N0} from {dto.CustomerName}";
            await notificationService.NotifyAsync(studioId, title, message, NotificationTypes.PaymentReceived, ct);
        }

        return PaymentWriteResult.Success(dto);
    }

    public async Task<PaymentWriteResult?> UpdateAsync(int studioId, int paymentId, UpdatePaymentRequestDto request, CancellationToken ct = default)
    {
        var payment = await paymentRepository.GetByIdAsync(studioId, paymentId, ct);
        if (payment is null)
        {
            return null;
        }

        var failure = await ValidateReferencesAsync(studioId, request.CustomerId, request.EventId, ct);
        if (failure is not null)
        {
            return PaymentWriteResult.Fail(failure.Value);
        }

        var problem = await unitOfWork.ExecuteInTransactionAsync(async tx =>
        {
            await paymentRepository.LockForPaymentAsync(studioId, request.CustomerId, request.EventId, tx);
            // An existing entry keeps working when only its status changes (e.g. cancelling an old
            // future-dated one), so the date rule is applied when the date itself is changed.
            var amountProblem = (payment.PaymentDate.Date != request.PaymentDate.Date || payment.PaymentStatus != request.PaymentStatus) && request.PaymentStatus != PaymentStatuses.Cancelled
                    ? CheckDate(request.PaymentDate, request.PaymentStatus) : null;
            amountProblem ??= await CheckAmountAsync(studioId, request.CustomerId, request.EventId, request.Amount,
                request.PaymentStatus, request.Notes, excludePaymentId: paymentId, tx);
            if (amountProblem is not null)
            {
                return amountProblem;
            }

            payment.CustomerId = request.CustomerId;
            payment.EventId = request.EventId;
            payment.Amount = request.Amount;
            payment.PaymentDate = request.PaymentDate;
            payment.PaymentMethod = request.PaymentMethod;
            payment.ReferenceNumber = request.ReferenceNumber;
            payment.Notes = request.Notes;
            payment.PaymentStatus = request.PaymentStatus;
            payment.UpdatedAt = DateTime.UtcNow;

            paymentRepository.Update(payment);
            await unitOfWork.SaveChangesAsync(tx);
            return (string?)null;
        }, ct);
        if (problem is not null)
        {
            return PaymentWriteResult.Fail(PaymentWriteFailureReason.AmountNotAllowed, problem);
        }

        await auditService.LogAsync("Payment updated", Module, studioId, ct);

        var updated = await paymentRepository.GetByIdAsync(studioId, paymentId, ct);
        var eventTotals = await GetEventTotalsAsync(studioId, [updated!], ct);
        return PaymentWriteResult.Success(MapToDto(updated!, eventTotals));
    }

    private async Task<PaymentWriteFailureReason?> ValidateReferencesAsync(int studioId, int customerId, int? eventId, CancellationToken ct)
    {
        var customer = await customerRepository.GetByIdAsync(studioId, customerId, ct);
        if (customer is null)
        {
            return PaymentWriteFailureReason.CustomerNotFound;
        }

        if (eventId is not null)
        {
            var evt = await eventRepository.GetByIdAsync(studioId, eventId.Value, ct);
            // The event must be this customer's own - a payment can't land on someone else's event.
            if (evt is null || evt.CustomerId != customerId)
            {
                return PaymentWriteFailureReason.EventNotFound;
            }
        }

        return null;
    }

    private static PaymentDto MapToDto(Payment payment, Dictionary<int, decimal> eventTotals)
    {
        var eventAmountPaid = payment.EventId is not null && eventTotals.TryGetValue(payment.EventId.Value, out var total) ? total : (decimal?)null;

        return new PaymentDto
        {
            PaymentId = payment.PaymentId,
            CustomerId = payment.CustomerId,
            CustomerName = payment.Customer.FullName,
            CustomerMobileNumber = payment.Customer.MobileNumber,
            EventId = payment.EventId,
            EventVenue = payment.Event?.Venue,
            EventBudget = payment.Event?.Budget,
            EventAmountPaid = eventAmountPaid,
            EventBalance = payment.Event is null ? null : (payment.Event.Budget ?? 0) - (eventAmountPaid ?? 0),
            Amount = payment.Amount,
            PaymentDate = payment.PaymentDate,
            PaymentMethod = payment.PaymentMethod,
            ReferenceNumber = payment.ReferenceNumber,
            Notes = payment.Notes,
            PaymentStatus = payment.PaymentStatus,
            CreatedAt = payment.CreatedAt,
            UpdatedAt = payment.UpdatedAt
        };
    }
}
