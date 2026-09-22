using System.Globalization;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Business.Notifications;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Events;

public class EventService(
    IEventRepository eventRepository,
    ICustomerRepository customerRepository,
    IPaymentRepository paymentRepository,
    IQuotationRepository quotationRepository,
    IEventWorkerRepository eventWorkerRepository,
    INotificationService notificationService,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IEventService
{
    private const string Module = "Events";
    private const string TimeFormat = @"hh\:mm";

    public async Task<PagedResult<EventDto>> SearchAsync(int studioId, string? search, string? eventStatus, int? customerId, DateTime? eventDate, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await eventRepository.SearchAsync(studioId, search, eventStatus, customerId, eventDate, page, pageSize, ct);
        return new PagedResult<EventDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<EventDto?> GetByIdAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        return @event is null ? null : MapToDto(@event);
    }

    public async Task<EventWriteResult> CreateAsync(int studioId, CreateEventRequestDto request, CancellationToken ct = default)
    {
        var customer = await customerRepository.GetByIdAsync(studioId, request.CustomerId, ct);
        if (customer is null)
        {
            return EventWriteResult.Fail(EventWriteFailureReason.CustomerNotFound);
        }

        var now = DateTime.UtcNow;
        var @event = new Event
        {
            StudioId = studioId,
            CustomerId = request.CustomerId,
            EventTypeId = request.EventTypeId,
            EventDate = request.EventDate,
            StartTime = ParseTime(request.StartTime),
            EndTime = ParseTime(request.EndTime),
            Venue = request.Venue,
            VenueAddress = request.VenueAddress,
            Budget = request.Budget,
            EventStatus = request.EventStatus,
            FileLocation = request.FileLocation,
            Notes = request.Notes,
            CompletedAt = request.EventStatus == EventStatuses.Completed ? now : null,
            CreatedAt = now,
            UpdatedAt = now
        };

        await eventRepository.AddAsync(@event, ct);

        var recordAdvance = request.AdvancePaid is > 0;
        if (recordAdvance)
        {
            // Same SaveChanges as the event itself — either both land or neither does.
            await paymentRepository.AddAsync(new Payment
            {
                StudioId = studioId,
                CustomerId = request.CustomerId,
                Event = @event,
                Amount = request.AdvancePaid!.Value,
                PaymentDate = now.Date,
                PaymentMethod = request.AdvancePaymentMethod!,
                Notes = "Advance recorded when the event was booked",
                PaymentStatus = PaymentStatuses.Completed,
                CreatedAt = now,
                UpdatedAt = now
            }, ct);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Event created", Module, studioId, ct);

        if (recordAdvance)
        {
            await auditService.LogAsync("Payment recorded", "Payments", studioId, ct);
            await notificationService.NotifyAsync(
                studioId, "Payment received", $"Payment received: ₹{request.AdvancePaid:N0} from {customer.FullName}", NotificationTypes.PaymentReceived, ct);
        }

        var created = await eventRepository.GetByIdAsync(studioId, @event.EventId, ct);
        return EventWriteResult.Success(MapToDto(created!));
    }

    public async Task<EventWriteResult?> UpdateAsync(int studioId, int eventId, UpdateEventRequestDto request, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        if (@event.CustomerId != request.CustomerId)
        {
            var customer = await customerRepository.GetByIdAsync(studioId, request.CustomerId, ct);
            if (customer is null)
            {
                return EventWriteResult.Fail(EventWriteFailureReason.CustomerNotFound);
            }
        }

        @event.CustomerId = request.CustomerId;
        @event.EventTypeId = request.EventTypeId;
        @event.EventDate = request.EventDate;
        @event.StartTime = ParseTime(request.StartTime);
        @event.EndTime = ParseTime(request.EndTime);
        @event.Venue = request.Venue;
        @event.VenueAddress = request.VenueAddress;
        @event.Budget = request.Budget;
        // The completion date is stamped once, the first time the event is marked Completed, and
        // survives later edits. Moving the event back out of Completed clears it.
        if (request.EventStatus == EventStatuses.Completed)
        {
            @event.CompletedAt ??= DateTime.UtcNow;
        }
        else
        {
            @event.CompletedAt = null;
        }

        @event.EventStatus = request.EventStatus;
        @event.FileLocation = request.FileLocation;
        @event.Notes = request.Notes;
        @event.UpdatedAt = DateTime.UtcNow;

        eventRepository.Update(@event);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Event updated", Module, studioId, ct);

        var updated = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        return EventWriteResult.Success(MapToDto(updated!));
    }

    public async Task<EventDto?> UpdateNotesAsync(int studioId, int eventId, string? notes, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        @event.Notes = notes;
        @event.UpdatedAt = DateTime.UtcNow;

        eventRepository.Update(@event);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Event notes updated", Module, studioId, ct);

        var updated = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        return MapToDto(updated!);
    }

    public async Task<EventDeleteResult> DeleteAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return EventDeleteResult.NotFound;
        }

        if (await eventRepository.HasQuotationsAsync(studioId, eventId, ct))
        {
            return EventDeleteResult.HasQuotations;
        }

        if (await eventRepository.HasPhotoGalleryAsync(studioId, eventId, ct))
        {
            return EventDeleteResult.HasPhotoGallery;
        }

        // Payments/Expenses referencing this event have EventId SetNull at the DB level — they
        // survive as un-linked records rather than blocking or cascading away real financial history.
        eventRepository.Remove(@event);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Event deleted", Module, studioId, ct);

        return EventDeleteResult.Deleted;
    }

    private static TimeSpan? ParseTime(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : TimeSpan.ParseExact(value, TimeFormat, CultureInfo.InvariantCulture);

    // The event's permanent record: the crew, every quotation ever raised for it (superseded ones
    // included) and every payment. Read-only, and nothing here is ever deleted or rewritten.
    public async Task<EventHistoryDto?> GetHistoryAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        var assignments = await eventWorkerRepository.GetByEventIdAsync(eventId, ct);
        var quotations = await quotationRepository.GetForEventAsync(studioId, eventId, ct);
        var payments = await paymentRepository.GetForEventAsync(studioId, eventId, ct);

        var quotationDtos = quotations.Select((q, index) => new EventHistoryQuotationDto
        {
            QuotationId = q.QuotationId,
            Version = $"V{index + 1}",
            QuotationNumber = q.QuotationNumber,
            QuotationDate = q.QuotationDate,
            Status = q.Status,
            GrandTotal = q.GrandTotal,
            IsApproved = q.Status == QuotationStatuses.Accepted
        }).ToList();

        // If more than one was ever accepted, the most recent accepted one is the live agreement.
        var approved = quotationDtos.LastOrDefault(q => q.IsApproved);

        return new EventHistoryDto
        {
            Event = MapToDto(@event),
            Workers = assignments.Select(a => new EventHistoryWorkerDto
            {
                WorkerId = a.WorkerId,
                WorkerName = a.Worker.FullName,
                WorkerTypeName = a.Worker.WorkerType?.Name,
                Role = a.Notes
            }).ToList(),
            Quotations = quotationDtos,
            ApprovedQuotation = approved,
            Payments = payments.Select(p => new EventHistoryPaymentDto
            {
                PaymentId = p.PaymentId,
                PaymentDate = p.PaymentDate,
                Amount = p.Amount,
                PaymentMethod = p.PaymentMethod,
                PaymentStatus = p.PaymentStatus,
                ReferenceNumber = p.ReferenceNumber,
                Notes = p.Notes
            }).ToList(),
            FinalAmount = approved?.GrandTotal ?? @event.Budget
        };
    }

    private static EventDto MapToDto(Event @event)
    {
        var amountPaid = @event.Payments.Where(p => p.PaymentStatus == PaymentStatuses.Completed).Sum(p => p.Amount);

        return new EventDto
        {
            EventId = @event.EventId,
            CustomerId = @event.CustomerId,
            CustomerName = @event.Customer.FullName,
            CustomerMobileNumber = @event.Customer.MobileNumber,
            EventTypeId = @event.EventTypeId,
            EventTypeName = @event.EventType?.Name,
            EventDate = @event.EventDate,
            StartTime = @event.StartTime?.ToString(TimeFormat, CultureInfo.InvariantCulture),
            EndTime = @event.EndTime?.ToString(TimeFormat, CultureInfo.InvariantCulture),
            Venue = @event.Venue,
            VenueAddress = @event.VenueAddress,
            Budget = @event.Budget,
            AmountPaid = amountPaid,
            Balance = (@event.Budget ?? 0) - amountPaid,
            EventStatus = @event.EventStatus,
            FileLocation = @event.FileLocation,
            Notes = @event.Notes,
            CompletedAt = @event.CompletedAt,
            CreatedAt = @event.CreatedAt,
            UpdatedAt = @event.UpdatedAt
        };
    }
}
