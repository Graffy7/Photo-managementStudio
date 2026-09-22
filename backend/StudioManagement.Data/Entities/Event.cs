namespace StudioManagement.Data.Entities;

public class Event : ITenantEntity
{
    public int EventId { get; set; }
    public int StudioId { get; set; }
    public int CustomerId { get; set; }
    public int? EventTypeId { get; set; }
    public DateTime EventDate { get; set; }
    public TimeSpan? StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public string? Venue { get; set; }
    public string? VenueAddress { get; set; }
    public decimal? Budget { get; set; }
    public string EventStatus { get; set; } = null!;
    public string? FileLocation { get; set; }
    public string? Notes { get; set; }

    // Set the moment the event is marked Completed, so the historical record keeps the real
    // completion date even if the row is touched again later.
    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public EventType? EventType { get; set; }
    public ICollection<EventWorker> EventWorkers { get; set; } = new List<EventWorker>();
    public ICollection<Quotation> Quotations { get; set; } = new List<Quotation>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
}
