namespace StudioManagement.Business.Workers;

public class WorkerDto
{
    public int WorkerId { get; set; }
    public string FullName { get; set; } = null!;
    public string? MobileNumber { get; set; }
    public string? Email { get; set; }
    public int? WorkerTypeId { get; set; }
    public string? WorkerTypeName { get; set; }
    public bool IsActive { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateWorkerRequestDto
{
    public string FullName { get; set; } = null!;
    public string? MobileNumber { get; set; }
    public string? Email { get; set; }
    public int? WorkerTypeId { get; set; }
    public string? Notes { get; set; }
}

public class UpdateWorkerRequestDto
{
    public string FullName { get; set; } = null!;
    public string? MobileNumber { get; set; }
    public string? Email { get; set; }
    public int? WorkerTypeId { get; set; }
    public string? Notes { get; set; }
}
