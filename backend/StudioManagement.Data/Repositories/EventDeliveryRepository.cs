using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class EventDeliveryRepository(AppDbContext context) : IEventDeliveryRepository
{
    public Task<List<EventDeliveryItem>> GetByEventAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.EventDeliveryItems
            .AsNoTracking()
            .Where(i => i.StudioId == studioId && i.EventId == eventId)
            .OrderBy(i => i.EventDeliveryItemId)
            .ToListAsync(ct);

    public Task<EventDeliveryItem?> GetByIdAsync(int studioId, int itemId, CancellationToken ct = default) =>
        context.EventDeliveryItems
            .FirstOrDefaultAsync(i => i.StudioId == studioId && i.EventDeliveryItemId == itemId, ct);

    public Task<EventDeliveryItem?> GetByKeyAsync(int studioId, int eventId, string itemKey, CancellationToken ct = default) =>
        context.EventDeliveryItems
            .FirstOrDefaultAsync(i => i.StudioId == studioId && i.EventId == eventId && i.ItemKey == itemKey, ct);

    public Task<bool> NameExistsAsync(int studioId, int eventId, string name, CancellationToken ct = default) =>
        context.EventDeliveryItems
            .AnyAsync(i => i.StudioId == studioId && i.EventId == eventId && i.Name == name, ct);

    public async Task AddAsync(EventDeliveryItem item, CancellationToken ct = default) =>
        await context.EventDeliveryItems.AddAsync(item, ct);

    public void Update(EventDeliveryItem item) => context.EventDeliveryItems.Update(item);

    public void Remove(EventDeliveryItem item) => context.EventDeliveryItems.Remove(item);
}
