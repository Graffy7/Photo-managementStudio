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
    IUnitOfWork unitOfWork) : IPaymentService
{
    private const string Module = "Payments";

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

        var now = DateTime.UtcNow;
        var payment = new Payment
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

        await paymentRepository.AddAsync(payment, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Payment recorded", Module, studioId, ct);

        var created = await paymentRepository.GetByIdAsync(studioId, payment.PaymentId, ct);
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
        await unitOfWork.SaveChangesAsync(ct);
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
            if (evt is null)
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
