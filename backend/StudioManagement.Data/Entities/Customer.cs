namespace StudioManagement.Data.Entities;

public class Customer : ITenantEntity
{
    public int CustomerId { get; set; }
    public int StudioId { get; set; }
    public string FullName { get; set; } = null!;
    public string MobileNumber { get; set; } = null!;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public ICollection<Event> Events { get; set; } = new List<Event>();
    public ICollection<Quotation> Quotations { get; set; } = new List<Quotation>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
