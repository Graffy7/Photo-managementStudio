using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class EventRepository(AppDbContext context) : IEventRepository
{
    // Events carry several child lists (payments, crew, delivery items). Loading them as JOINs in one
    // statement multiplies the row estimates of every list together, which made SQL Server reserve
    // gigabytes of query memory per call and starve every other query. AsSplitQuery loads each list
    // in its own small query instead - same result, a fraction of the memory.
    public Task<Event?> GetByIdAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.Events
            .AsSplitQuery()
            .Include(e => e.Customer)
            .Include(e => e.EventType)
            .Include(e => e.Payments)
            .Include(e => e.EventWorkers).ThenInclude(ew => ew.Worker).ThenInclude(w => w.WorkerType)
            .Include(e => e.DeliveryItems)
            .FirstOrDefaultAsync(e => e.StudioId == studioId && e.EventId == eventId, ct);

    public async Task<(List<Event> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? eventStatus, int? customerId, DateTime? eventDate, int page, int pageSize, CancellationToken ct = default, DateTime? upcomingFrom = null, ListSort? sort = null)
    {
        // Filters only; the page's events are loaded with their details below.
        var query = context.Events
            .AsNoTracking()
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

        // The dashboard's "Upcoming Events": still to happen (Upcoming or Confirmed) from that day on.
        if (upcomingFrom is not null)
        {
            var from = upcomingFrom.Value.Date;
            query = query.Where(e => e.EventDate >= from &&
                                     (e.EventStatus == EventStatuses.Upcoming || e.EventStatus == EventStatuses.Confirmed));
        }

        var totalCount = await query.CountAsync(ct);
        var desc = sort?.Descending ?? false;
        var ordered = sort?.Key switch
        {
            "customer" => query.OrderByDirection(e => e.Customer.FullName, desc),
            "status" => query.OrderByDirection(e => e.EventStatus, desc),
            "total" => query.OrderByDirection(e => e.Budget, desc),
            "date" => query.OrderByDirection(e => e.EventDate, desc),
            _ => query.OrderBy(e => e.EventDate),
        };
        // Two steps: first the page's ids, sorting only the narrow sort columns; then just those events
        // with their details. Sorting whole rows (notes, addresses...) before OFFSET made SQL Server
        // reserve gigabytes of memory for a 20-row page once a studio had many events.
        var pageIds = await ordered
            .ThenBy(e => e.StartTime)
            .ThenBy(e => e.EventId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => e.EventId)
            .ToListAsync(ct);
        if (pageIds.Count == 0)
        {
            return ([], totalCount);
        }

        // Each child list in its own query (AsSplitQuery). Measured: even for just the page's ids, one
        // JOINed query asked SQL Server for ~100 GB of memory once tables were production-sized.
        var loaded = await context.Events
            .AsNoTracking()
            .AsSplitQuery()
            .Include(e => e.Customer)
            .Include(e => e.EventType)
            .Include(e => e.Payments)
            .Include(e => e.EventWorkers).ThenInclude(ew => ew.Worker).ThenInclude(w => w.WorkerType)
            .Include(e => e.DeliveryItems)
            .Where(e => e.StudioId == studioId && pageIds.Contains(e.EventId))
            .ToDictionaryAsync(e => e.EventId, ct);
        var items = pageIds.Where(loaded.ContainsKey).Select(id => loaded[id]).ToList();

        return (items, totalCount);
    }

    public Task<List<Event>> GetForDayAsync(int studioId, DateTime dayStart, DateTime dayEnd, CancellationToken ct = default) =>
        context.Events
            .AsNoTracking()
            .AsSplitQuery()
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
            .AsSplitQuery()
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

    public Task<bool> HasPaymentsAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.Payments.AnyAsync(p => p.StudioId == studioId && p.EventId == eventId, ct);

    public Task<bool> ExistsAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.Events.AnyAsync(e => e.StudioId == studioId && e.EventId == eventId, ct);

    public Task<byte[]?> GetRowVersionAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.Events.AsNoTracking()
            .Where(e => e.StudioId == studioId && e.EventId == eventId)
            .Select(e => (byte[]?)e.RowVersion)
            .FirstOrDefaultAsync(ct);

    public Task<bool> HasPhotoGalleryAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.PhotoGalleries.AnyAsync(g => g.StudioId == studioId && g.EventId == eventId, ct);
}
