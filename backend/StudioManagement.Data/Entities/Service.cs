namespace StudioManagement.Data.Entities;

public class Service : ITenantEntity
{
    public int ServiceId { get; set; }
    public int StudioId { get; set; }
    public string ServiceName { get; set; } = null!;
    public string? Description { get; set; }
    public decimal DefaultPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public ICollection<QuotationItem> QuotationItems { get; set; } = new List<QuotationItem>();
}
