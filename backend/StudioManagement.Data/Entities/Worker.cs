namespace StudioManagement.Data.Entities;

public class Worker : ITenantEntity
{
    public int WorkerId { get; set; }
    public int StudioId { get; set; }
    public string FullName { get; set; } = null!;
    public string? MobileNumber { get; set; }
    public string? Email { get; set; }
    public int? WorkerTypeId { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public WorkerType? WorkerType { get; set; }
    public ICollection<EventWorker> EventWorkers { get; set; } = new List<EventWorker>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
}
