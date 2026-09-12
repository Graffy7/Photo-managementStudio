using System.Globalization;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Events;

public class EventService(
    IEventRepository eventRepository,
    ICustomerRepository customerRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IEventService
{
    private const string Module = "Events";
    private const string TimeFormat = @"hh\:mm";

    public async Task<PagedResult<EventDto>> SearchAsync(int studioId, string? search, string? eventStatus, int? customerId, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await eventRepository.SearchAsync(studioId, search, eventStatus, customerId, page, pageSize, ct);
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
            CreatedAt = now,
            UpdatedAt = now
        };

        await eventRepository.AddAsync(@event, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Event created", Module, studioId, ct);

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

    private static TimeSpan? ParseTime(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : TimeSpan.ParseExact(value, TimeFormat, CultureInfo.InvariantCulture);

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
            CreatedAt = @event.CreatedAt,
            UpdatedAt = @event.UpdatedAt
        };
    }
}
