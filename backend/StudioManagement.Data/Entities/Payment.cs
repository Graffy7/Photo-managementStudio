namespace StudioManagement.Data.Entities;

public class Payment : ITenantEntity
{
    public int PaymentId { get; set; }
    public int StudioId { get; set; }
    public int CustomerId { get; set; }
    public int? EventId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public string PaymentStatus { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = null!;

    // The advance taken when the event was booked (recorded together with the event). Lets the
    // owner's WhatsApp payment summary show "Advance Paid" separately from the total paid.
    public bool IsAdvance { get; set; }

    public Studio Studio { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public Event? Event { get; set; }
}
