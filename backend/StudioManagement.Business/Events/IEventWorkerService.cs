namespace StudioManagement.Business.Events;

public interface IEventWorkerService
{
    Task<List<AssignedWorkerDto>?> GetAssignedWorkersAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<EventWorkerResult> AssignWorkerAsync(int studioId, int eventId, AssignWorkerRequestDto request, CancellationToken ct = default);
    Task<bool?> UnassignWorkerAsync(int studioId, int eventId, int workerId, CancellationToken ct = default);
}
