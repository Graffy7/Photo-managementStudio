using StudioManagement.Business.Common;

namespace StudioManagement.Business.Workers;

public interface IWorkerService
{
    Task<PagedResult<WorkerDto>> SearchAsync(int studioId, string? search, int? workerTypeId, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task<WorkerDto?> GetByIdAsync(int studioId, int workerId, CancellationToken ct = default);
    Task<WorkerDto> CreateAsync(int studioId, CreateWorkerRequestDto request, CancellationToken ct = default);
    Task<WorkerDto?> UpdateAsync(int studioId, int workerId, UpdateWorkerRequestDto request, CancellationToken ct = default);
    Task<WorkerDto?> SetActiveAsync(int studioId, int workerId, bool isActive, CancellationToken ct = default);
}
