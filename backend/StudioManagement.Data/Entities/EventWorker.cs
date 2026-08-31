namespace StudioManagement.Data.Entities;

public class EventWorker
{
    public int EventWorkerId { get; set; }
    public int EventId { get; set; }
    public int WorkerId { get; set; }
    public DateTime AssignedAt { get; set; }
    public string? Notes { get; set; }

    public Event Event { get; set; } = null!;
    public Worker Worker { get; set; } = null!;
}
