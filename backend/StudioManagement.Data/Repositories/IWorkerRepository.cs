using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IWorkerRepository
{
    Task<Worker?> GetByIdAsync(int studioId, int workerId, CancellationToken ct = default);
    Task<(List<Worker> Items, int TotalCount)> SearchAsync(int studioId, string? search, int? workerTypeId, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Worker worker, CancellationToken ct = default);
    void Update(Worker worker);
}
