namespace StudioManagement.Business.Events;

public enum DeliveryFailureReason
{
    EventNotFound,
    ItemNotFound,
    DuplicateName,
    // The three standard items are part of every event's checklist and cannot be removed.
    StandardItemCannotBeDeleted
}

public class DeliveryResult
{
    public bool Succeeded { get; private init; }
    public DeliveryFailureReason? FailureReason { get; private init; }
    public EventDeliveryItemDto? Item { get; private init; }

    public static DeliveryResult Success(EventDeliveryItemDto? item = null) => new() { Succeeded = true, Item = item };
    public static DeliveryResult Fail(DeliveryFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public interface IEventDeliveryService
{
    Task<List<EventDeliveryItemDto>?> GetAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<DeliveryResult> AddCustomAsync(int studioId, int eventId, AddDeliveryItemRequestDto request, CancellationToken ct = default);
    Task<DeliveryResult> SetStatusAsync(int studioId, int eventId, SetDeliveryStatusRequestDto request, CancellationToken ct = default);
    Task<DeliveryResult> DeleteCustomAsync(int studioId, int eventId, int itemId, CancellationToken ct = default);
}
