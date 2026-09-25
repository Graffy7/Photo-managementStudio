namespace StudioManagement.Data.Entities;

public class Quotation : ITenantEntity
{
    public int QuotationId { get; set; }
    public int StudioId { get; set; }
    public string QuotationNumber { get; set; } = null!;
    public int CustomerId { get; set; }
    public int? EventId { get; set; }
    public DateTime QuotationDate { get; set; }
    public DateTime? ValidUntil { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string Status { get; set; } = null!;
    public string? TermsAndConditions { get; set; }

    // QuotationPriceDisplays: how this quotation's PDF shows prices (this quotation only).
    public string PriceDisplay { get; set; } = "Detailed";

    // A total typed in by hand for a "Total only" quotation. When set it IS the quotation's grand
    // total (approved amount, balances, reports); the item prices stay stored for reference.
    public decimal? ManualTotal { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = null!;

    public Studio Studio { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public Event? Event { get; set; }
    public ICollection<QuotationItem> Items { get; set; } = new List<QuotationItem>();
}
