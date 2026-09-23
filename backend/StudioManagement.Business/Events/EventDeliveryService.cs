using StudioManagement.Business.Audit;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Events;

// The delivery checklist for one event. The three standard items always appear, whether or not a
// row exists for them yet: a row is written the first time one is ticked. Anything the studio adds
// is stored with no ItemKey, which is what makes it removable.
public class EventDeliveryService(
    IEventDeliveryRepository deliveryRepository,
    IEventRepository eventRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IEventDeliveryService
{
    private const string Module = "Events";

    public async Task<List<EventDeliveryItemDto>?> GetAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        var stored = await deliveryRepository.GetByEventAsync(studioId, eventId, ct);
        return Merge(stored);
    }

    // Standard items first, in their fixed order, then whatever the studio added, oldest first.
    public static List<EventDeliveryItemDto> Merge(IEnumerable<EventDeliveryItem> stored)
    {
        var rows = stored.ToList();
        var items = new List<EventDeliveryItemDto>();

        foreach (var key in DeliveryItems.Defaults)
        {
            var row = rows.FirstOrDefault(r => r.ItemKey == key);
            items.Add(new EventDeliveryItemDto
            {
                ItemId = row?.EventDeliveryItemId ?? 0,
                ItemKey = key,
                Name = row?.Name ?? key,
                IsDelivered = row?.IsDelivered ?? false,
                DeliveredAt = row?.DeliveredAt,
                IsCustom = false
            });
        }

        items.AddRange(rows
            .Where(r => r.ItemKey is null)
            .OrderBy(r => r.EventDeliveryItemId)
            .Select(r => new EventDeliveryItemDto
            {
                ItemId = r.EventDeliveryItemId,
                ItemKey = null,
                Name = r.Name,
                IsDelivered = r.IsDelivered,
                DeliveredAt = r.DeliveredAt,
                IsCustom = true
            }));

        return items;
    }

    public async Task<DeliveryResult> AddCustomAsync(int studioId, int eventId, AddDeliveryItemRequestDto request, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return DeliveryResult.Fail(DeliveryFailureReason.EventNotFound);
        }

        var name = request.Name.Trim();
        if (DeliveryItems.Defaults.Contains(name, StringComparer.OrdinalIgnoreCase)
            || await deliveryRepository.NameExistsAsync(studioId, eventId, name, ct))
        {
            return DeliveryResult.Fail(DeliveryFailureReason.DuplicateName);
        }

        var now = DateTime.UtcNow;
        var item = new EventDeliveryItem
        {
            StudioId = studioId,
            EventId = eventId,
            ItemKey = null,
            Name = name,
            IsDelivered = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        await deliveryRepository.AddAsync(item, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Delivery item '{name}' added to event {eventId}", Module, studioId, ct);

        return DeliveryResult.Success(new EventDeliveryItemDto
        {
            ItemId = item.EventDeliveryItemId,
            Name = item.Name,
            IsDelivered = false,
            IsCustom = true
        });
    }

    public async Task<DeliveryResult> SetStatusAsync(int studioId, int eventId, SetDeliveryStatusRequestDto request, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return DeliveryResult.Fail(DeliveryFailureReason.EventNotFound);
        }

        var now = DateTime.UtcNow;
        EventDeliveryItem? item = null;

        if (request.ItemId > 0)
        {
            item = await deliveryRepository.GetByIdAsync(studioId, request.ItemId, ct);
            if (item is null || item.EventId != eventId)
            {
                return DeliveryResult.Fail(DeliveryFailureReason.ItemNotFound);
            }
        }
        else
        {
            var key = DeliveryItems.Defaults
                .FirstOrDefault(d => string.Equals(d, request.ItemKey, StringComparison.OrdinalIgnoreCase));
            if (key is null)
            {
                return DeliveryResult.Fail(DeliveryFailureReason.ItemNotFound);
            }

            item = await deliveryRepository.GetByKeyAsync(studioId, eventId, key, ct);
            if (item is null)
            {
                // First time this standard item is ticked - now it earns a row.
                item = new EventDeliveryItem
                {
                    StudioId = studioId,
                    EventId = eventId,
                    ItemKey = key,
                    Name = key,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await deliveryRepository.AddAsync(item, ct);
            }
        }

        item.IsDelivered = request.IsDelivered;
        item.DeliveredAt = request.IsDelivered ? now : null;
        item.UpdatedAt = now;

        if (item.EventDeliveryItemId > 0)
        {
            deliveryRepository.Update(item);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(
            $"Delivery item '{item.Name}' marked {(request.IsDelivered ? "delivered" : "pending")} on event {eventId}",
            Module, studioId, ct);

        return DeliveryResult.Success(new EventDeliveryItemDto
        {
            ItemId = item.EventDeliveryItemId,
            ItemKey = item.ItemKey,
            Name = item.Name,
            IsDelivered = item.IsDelivered,
            DeliveredAt = item.DeliveredAt,
            IsCustom = item.ItemKey is null
        });
    }

    public async Task<DeliveryResult> DeleteCustomAsync(int studioId, int eventId, int itemId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return DeliveryResult.Fail(DeliveryFailureReason.EventNotFound);
        }

        var item = await deliveryRepository.GetByIdAsync(studioId, itemId, ct);
        if (item is null || item.EventId != eventId)
        {
            return DeliveryResult.Fail(DeliveryFailureReason.ItemNotFound);
        }
        if (item.ItemKey is not null)
        {
            return DeliveryResult.Fail(DeliveryFailureReason.StandardItemCannotBeDeleted);
        }

        deliveryRepository.Remove(item);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Delivery item '{item.Name}' removed from event {eventId}", Module, studioId, ct);
        return DeliveryResult.Success();
    }
}
