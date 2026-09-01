namespace StudioManagement.Business.Events;

public class AssignedWorkerDto
{
    public int EventWorkerId { get; set; }
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = null!;
    public string? WorkerMobileNumber { get; set; }
    public string? WorkerTypeName { get; set; }
    public string? Notes { get; set; }
}

public class AssignWorkerRequestDto
{
    public int WorkerId { get; set; }
    public string? Notes { get; set; }
}
