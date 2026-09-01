using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Workers;

public class WorkerService(
    IWorkerRepository workerRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IWorkerService
{
    private const string Module = "Workers";

    public async Task<PagedResult<WorkerDto>> SearchAsync(int studioId, string? search, int? workerTypeId, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await workerRepository.SearchAsync(studioId, search, workerTypeId, isActive, page, pageSize, ct);
        return new PagedResult<WorkerDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<WorkerDto?> GetByIdAsync(int studioId, int workerId, CancellationToken ct = default)
    {
        var worker = await workerRepository.GetByIdAsync(studioId, workerId, ct);
        return worker is null ? null : MapToDto(worker);
    }

    public async Task<WorkerDto> CreateAsync(int studioId, CreateWorkerRequestDto request, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var worker = new Worker
        {
            StudioId = studioId,
            FullName = request.FullName,
            MobileNumber = request.MobileNumber,
            Email = request.Email,
            WorkerTypeId = request.WorkerTypeId,
            Notes = request.Notes,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        await workerRepository.AddAsync(worker, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Worker created", Module, studioId, ct);

        var created = await workerRepository.GetByIdAsync(studioId, worker.WorkerId, ct);
        return MapToDto(created!);
    }

    public async Task<WorkerDto?> UpdateAsync(int studioId, int workerId, UpdateWorkerRequestDto request, CancellationToken ct = default)
    {
        var worker = await workerRepository.GetByIdAsync(studioId, workerId, ct);
        if (worker is null)
        {
            return null;
        }

        worker.FullName = request.FullName;
        worker.MobileNumber = request.MobileNumber;
        worker.Email = request.Email;
        worker.WorkerTypeId = request.WorkerTypeId;
        worker.Notes = request.Notes;
        worker.UpdatedAt = DateTime.UtcNow;

        workerRepository.Update(worker);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Worker updated", Module, studioId, ct);

        var updated = await workerRepository.GetByIdAsync(studioId, workerId, ct);
        return MapToDto(updated!);
    }

    public async Task<WorkerDto?> SetActiveAsync(int studioId, int workerId, bool isActive, CancellationToken ct = default)
    {
        var worker = await workerRepository.GetByIdAsync(studioId, workerId, ct);
        if (worker is null)
        {
            return null;
        }

        worker.IsActive = isActive;
        worker.UpdatedAt = DateTime.UtcNow;

        workerRepository.Update(worker);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(isActive ? "Worker activated" : "Worker deactivated", Module, studioId, ct);

        return MapToDto(worker);
    }

    private static WorkerDto MapToDto(Worker worker) => new()
    {
        WorkerId = worker.WorkerId,
        FullName = worker.FullName,
        MobileNumber = worker.MobileNumber,
        Email = worker.Email,
        WorkerTypeId = worker.WorkerTypeId,
        WorkerTypeName = worker.WorkerType?.Name,
        IsActive = worker.IsActive,
        Notes = worker.Notes,
        CreatedAt = worker.CreatedAt,
        UpdatedAt = worker.UpdatedAt
    };
}
