namespace StudioManagement.Data.Entities;

public class QuotationItem
{
    public int QuotationItemId { get; set; }
    public int QuotationId { get; set; }
    // A service from the studio's catalog, or null for a line typed in by hand (CustomName).
    public int? ServiceId { get; set; }
    public string? CustomName { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public string? Notes { get; set; }

    public Quotation Quotation { get; set; } = null!;
    public Service? Service { get; set; }
}
