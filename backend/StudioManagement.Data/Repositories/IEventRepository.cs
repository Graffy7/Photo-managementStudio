using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IEventRepository
{
    Task<Event?> GetByIdAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<(List<Event> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? eventStatus, int? customerId, DateTime? eventDate, int page, int pageSize, CancellationToken ct = default, DateTime? upcomingFrom = null);
    Task<List<Event>> GetForDayAsync(int studioId, DateTime dayStart, DateTime dayEnd, CancellationToken ct = default);
    Task<List<Event>> GetForCustomerAsync(int studioId, int customerId, CancellationToken ct = default);
    Task AddAsync(Event @event, CancellationToken ct = default);
    void Update(Event @event);
    void Remove(Event @event);

    // Quotations Restrict-delete against Event — checked up front so a blocked delete returns a
    // friendly reason instead of an unhandled FK-violation exception.
    // For WhatsApp reminders: customer, type and assigned workers — deliberately NO payments, so the
    // worker-facing message can't be built from anything financial. eventId narrows to one event.
    Task<List<Event>> GetForReminderAsync(int studioId, DateTime dayStart, DateTime dayEnd, int? eventId = null, CancellationToken ct = default);

    Task<bool> HasQuotationsAsync(int studioId, int eventId, CancellationToken ct = default);

    // PhotoGalleries Restrict-delete against Event too (its customer selections are worth keeping).
    Task<bool> HasPhotoGalleryAsync(int studioId, int eventId, CancellationToken ct = default);
}
