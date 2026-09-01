using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IEventWorkerRepository
{
    Task<List<EventWorker>> GetByEventIdAsync(int eventId, CancellationToken ct = default);
    Task<EventWorker?> GetAsync(int eventId, int workerId, CancellationToken ct = default);
    Task AddAsync(EventWorker assignment, CancellationToken ct = default);
    void Remove(EventWorker assignment);
}
