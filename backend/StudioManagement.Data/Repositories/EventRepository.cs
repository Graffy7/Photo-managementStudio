using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class EventRepository(AppDbContext context) : IEventRepository
{
    public Task<Event?> GetByIdAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.Events
            .Include(e => e.Customer)
            .Include(e => e.EventType)
            .Include(e => e.Payments)
            .Include(e => e.EventWorkers).ThenInclude(ew => ew.Worker).ThenInclude(w => w.WorkerType)
            .FirstOrDefaultAsync(e => e.StudioId == studioId && e.EventId == eventId, ct);

    public async Task<(List<Event> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? eventStatus, int? customerId, DateTime? eventDate, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Events
            .AsNoTracking()
            .Include(e => e.Customer)
            .Include(e => e.EventType)
            .Include(e => e.Payments)
            .Include(e => e.EventWorkers).ThenInclude(ew => ew.Worker).ThenInclude(w => w.WorkerType)
            .Where(e => e.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(e => e.Customer.FullName.Contains(term) || (e.Venue != null && e.Venue.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(eventStatus))
        {
            query = query.Where(e => e.EventStatus == eventStatus);
        }

        if (customerId is not null)
        {
            query = query.Where(e => e.CustomerId == customerId);
        }

        // EventDate is a calendar day stored at midnight, so an exact day match is enough.
        if (eventDate is not null)
        {
            var day = eventDate.Value.Date;
            query = query.Where(e => e.EventDate == day);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderBy(e => e.EventDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<List<Event>> GetForDayAsync(int studioId, DateTime dayStart, DateTime dayEnd, CancellationToken ct = default) =>
        context.Events
            .AsNoTracking()
            .Include(e => e.Customer)
            .Include(e => e.EventType)
            .Include(e => e.EventWorkers).ThenInclude(ew => ew.Worker).ThenInclude(w => w.WorkerType)
            .Include(e => e.Payments)
            .Where(e => e.StudioId == studioId && e.EventDate >= dayStart && e.EventDate < dayEnd)
            .OrderBy(e => e.StartTime ?? TimeSpan.MaxValue)
            .ThenBy(e => e.EventId)
            .ToListAsync(ct);

    public Task<List<Event>> GetForReminderAsync(int studioId, DateTime dayStart, DateTime dayEnd, int? eventId = null, CancellationToken ct = default) =>
        context.Events
            .AsNoTracking()
            .Include(e => e.Customer)
            .Include(e => e.EventType)
            .Include(e => e.EventWorkers).ThenInclude(ew => ew.Worker).ThenInclude(w => w.WorkerType)
            .Where(e => e.StudioId == studioId
                        && e.EventStatus != EventStatuses.Cancelled
                        && (eventId != null ? e.EventId == eventId : e.EventDate >= dayStart && e.EventDate < dayEnd))
            .OrderBy(e => e.StartTime ?? TimeSpan.MaxValue)
            .ThenBy(e => e.EventId)
            .ToListAsync(ct);

    public Task<List<Event>> GetForCustomerAsync(int studioId, int customerId, CancellationToken ct = default) =>
        context.Events
            .AsNoTracking()
            .Include(e => e.EventType)
            .Include(e => e.EventWorkers)
            .Include(e => e.Payments)
            .Include(e => e.Quotations)
            .Where(e => e.StudioId == studioId && e.CustomerId == customerId)
            .OrderByDescending(e => e.EventDate)
            .ToListAsync(ct);

    public async Task AddAsync(Event @event, CancellationToken ct = default) =>
        await context.Events.AddAsync(@event, ct);

    public void Update(Event @event) => context.Events.Update(@event);

    public void Remove(Event @event) => context.Events.Remove(@event);

    public Task<bool> HasQuotationsAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.Quotations.AnyAsync(q => q.StudioId == studioId && q.EventId == eventId, ct);

    public Task<bool> HasPhotoGalleryAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.PhotoGalleries.AnyAsync(g => g.StudioId == studioId && g.EventId == eventId, ct);
}
