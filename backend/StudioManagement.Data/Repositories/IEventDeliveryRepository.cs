using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IEventDeliveryRepository
{
    Task<List<EventDeliveryItem>> GetByEventAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<EventDeliveryItem?> GetByIdAsync(int studioId, int itemId, CancellationToken ct = default);
    Task<EventDeliveryItem?> GetByKeyAsync(int studioId, int eventId, string itemKey, CancellationToken ct = default);
    Task<bool> NameExistsAsync(int studioId, int eventId, string name, CancellationToken ct = default);
    Task AddAsync(EventDeliveryItem item, CancellationToken ct = default);
    void Update(EventDeliveryItem item);
    void Remove(EventDeliveryItem item);
}
