using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class EventWorkerRepository(AppDbContext context) : IEventWorkerRepository
{
    public Task<List<EventWorker>> GetByEventIdAsync(int eventId, CancellationToken ct = default) =>
        context.EventWorkers
            .AsNoTracking()
            .Include(ew => ew.Worker).ThenInclude(w => w.WorkerType)
            .Where(ew => ew.EventId == eventId)
            .OrderBy(ew => ew.AssignedAt)
            .ToListAsync(ct);

    public Task<EventWorker?> GetAsync(int eventId, int workerId, CancellationToken ct = default) =>
        context.EventWorkers.FirstOrDefaultAsync(ew => ew.EventId == eventId && ew.WorkerId == workerId, ct);

    public async Task AddAsync(EventWorker assignment, CancellationToken ct = default) =>
        await context.EventWorkers.AddAsync(assignment, ct);

    public void Remove(EventWorker assignment) => context.EventWorkers.Remove(assignment);
}
