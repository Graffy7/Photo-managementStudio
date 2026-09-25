using StudioManagement.Business.Common;

namespace StudioManagement.Business.Events;

public enum EventWriteFailureReason
{
    CustomerNotFound,
    // The new total is below (or clears) what has already been paid for the event.
    TotalBelowPaid
}

public class EventWriteResult
{
    public bool Succeeded { get; private init; }
    public EventWriteFailureReason? FailureReason { get; private init; }
    public EventDto? Event { get; private init; }
    public string? Message { get; private init; }

    public static EventWriteResult Success(EventDto dto) => new() { Succeeded = true, Event = dto };
    public static EventWriteResult Fail(EventWriteFailureReason reason, string? message = null) => new() { Succeeded = false, FailureReason = reason, Message = message };
}

public enum EventDeleteResult
{
    Deleted,
    NotFound,
    // Quotations Restrict-delete against Event — cancelling the event instead is the way out.
    HasQuotations,
    // A photo-selection gallery exists for the event (Restrict FK) — its selections are the customer's work.
    HasPhotoGallery
}

public interface IEventService
{
    Task<PagedResult<EventDto>> SearchAsync(int studioId, string? search, string? eventStatus, int? customerId, DateTime? eventDate, int page, int pageSize, CancellationToken ct = default, DateTime? upcomingFrom = null);
    Task<EventDto?> GetByIdAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<EventHistoryDto?> GetHistoryAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<EventWriteResult> CreateAsync(int studioId, CreateEventRequestDto request, CancellationToken ct = default);
    Task<EventWriteResult?> UpdateAsync(int studioId, int eventId, UpdateEventRequestDto request, CancellationToken ct = default);
    Task<EventDto?> UpdateNotesAsync(int studioId, int eventId, string? notes, CancellationToken ct = default);
    Task<EventDeleteResult> DeleteAsync(int studioId, int eventId, CancellationToken ct = default);
}
