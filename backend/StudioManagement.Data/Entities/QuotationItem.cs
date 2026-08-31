namespace StudioManagement.Data.Entities;

public class QuotationItem
{
    public int QuotationItemId { get; set; }
    public int QuotationId { get; set; }
    public int ServiceId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public string? Notes { get; set; }

    public Quotation Quotation { get; set; } = null!;
    public Service Service { get; set; } = null!;
}
