using StudioManagement.Business.Audit;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Events;

public class EventWorkerService(
    IEventWorkerRepository eventWorkerRepository,
    IEventRepository eventRepository,
    IWorkerRepository workerRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IEventWorkerService
{
    private const string Module = "Events";

    public async Task<List<AssignedWorkerDto>?> GetAssignedWorkersAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        var assignments = await eventWorkerRepository.GetByEventIdAsync(eventId, ct);
        return assignments.Select(MapToDto).ToList();
    }

    public async Task<EventWorkerResult> AssignWorkerAsync(int studioId, int eventId, AssignWorkerRequestDto request, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return EventWorkerResult.Fail(EventWorkerFailureReason.EventNotFound);
        }

        var worker = await workerRepository.GetByIdAsync(studioId, request.WorkerId, ct);
        if (worker is null)
        {
            return EventWorkerResult.Fail(EventWorkerFailureReason.WorkerNotFound);
        }

        var existing = await eventWorkerRepository.GetAsync(eventId, request.WorkerId, ct);
        if (existing is not null)
        {
            return EventWorkerResult.Fail(EventWorkerFailureReason.AlreadyAssigned);
        }

        var assignment = new EventWorker
        {
            EventId = eventId,
            WorkerId = request.WorkerId,
            AssignedAt = DateTime.UtcNow,
            Notes = request.Notes
        };

        await eventWorkerRepository.AddAsync(assignment, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Worker assigned to event", Module, studioId, ct);

        assignment.Worker = worker;
        return EventWorkerResult.Success(MapToDto(assignment));
    }

    public async Task<bool?> UnassignWorkerAsync(int studioId, int eventId, int workerId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        var assignment = await eventWorkerRepository.GetAsync(eventId, workerId, ct);
        if (assignment is null)
        {
            return false;
        }

        eventWorkerRepository.Remove(assignment);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Worker unassigned from event", Module, studioId, ct);
        return true;
    }

    private static AssignedWorkerDto MapToDto(EventWorker assignment) => new()
    {
        EventWorkerId = assignment.EventWorkerId,
        WorkerId = assignment.WorkerId,
        WorkerName = assignment.Worker.FullName,
        WorkerMobileNumber = assignment.Worker.MobileNumber,
        WorkerTypeName = assignment.Worker.WorkerType?.Name,
        Notes = assignment.Notes
    };
}
