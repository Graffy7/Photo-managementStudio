using StudioManagement.Business.Common;

namespace StudioManagement.Business.Events;

public enum EventWriteFailureReason
{
    CustomerNotFound
}

public class EventWriteResult
{
    public bool Succeeded { get; private init; }
    public EventWriteFailureReason? FailureReason { get; private init; }
    public EventDto? Event { get; private init; }

    public static EventWriteResult Success(EventDto dto) => new() { Succeeded = true, Event = dto };
    public static EventWriteResult Fail(EventWriteFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public enum EventDeleteResult
{
    Deleted,
    NotFound,
    // Quotations Restrict-delete against Event — cancelling the event instead is the way out.
    HasQuotations
}

public interface IEventService
{
    Task<PagedResult<EventDto>> SearchAsync(int studioId, string? search, string? eventStatus, int? customerId, int page, int pageSize, CancellationToken ct = default);
    Task<EventDto?> GetByIdAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<EventWriteResult> CreateAsync(int studioId, CreateEventRequestDto request, CancellationToken ct = default);
    Task<EventWriteResult?> UpdateAsync(int studioId, int eventId, UpdateEventRequestDto request, CancellationToken ct = default);
    Task<EventDto?> UpdateNotesAsync(int studioId, int eventId, string? notes, CancellationToken ct = default);
    Task<EventDeleteResult> DeleteAsync(int studioId, int eventId, CancellationToken ct = default);
}
