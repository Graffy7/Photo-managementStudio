namespace StudioManagement.Business.Events;

public enum EventWorkerFailureReason
{
    EventNotFound,
    WorkerNotFound,
    AlreadyAssigned
}

public class EventWorkerResult
{
    public bool Succeeded { get; private init; }
    public EventWorkerFailureReason? FailureReason { get; private init; }
    public AssignedWorkerDto? Assignment { get; private init; }

    public static EventWorkerResult Success(AssignedWorkerDto dto) => new() { Succeeded = true, Assignment = dto };
    public static EventWorkerResult Fail(EventWorkerFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
