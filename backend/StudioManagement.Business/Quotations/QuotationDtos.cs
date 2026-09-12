namespace StudioManagement.Business.Quotations;

public class QuotationItemDto
{
    public int QuotationItemId { get; set; }
    public int ServiceId { get; set; }
    public string ServiceName { get; set; } = null!;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public string? Notes { get; set; }
}

public class QuotationDto
{
    public int QuotationId { get; set; }
    public string QuotationNumber { get; set; } = null!;
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public string CustomerMobileNumber { get; set; } = null!;
    public int? EventId { get; set; }
    public string? EventVenue { get; set; }
    public DateTime QuotationDate { get; set; }
    public DateTime? ValidUntil { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string Status { get; set; } = null!;
    public string? TermsAndConditions { get; set; }
    public List<QuotationItemDto> Items { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class QuotationItemRequestDto
{
    public int ServiceId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? Notes { get; set; }
}

public class CreateQuotationRequestDto
{
    public int CustomerId { get; set; }
    public int? EventId { get; set; }
    public DateTime QuotationDate { get; set; }
    public DateTime? ValidUntil { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxAmount { get; set; }
    public string Status { get; set; } = null!;
    public string? TermsAndConditions { get; set; }
    public List<QuotationItemRequestDto> Items { get; set; } = [];
}

public class UpdateQuotationRequestDto
{
    public int CustomerId { get; set; }
    public int? EventId { get; set; }
    public DateTime QuotationDate { get; set; }
    public DateTime? ValidUntil { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxAmount { get; set; }
    public string Status { get; set; } = null!;
    public string? TermsAndConditions { get; set; }
    public List<QuotationItemRequestDto> Items { get; set; } = [];
}

public class SetQuotationStatusRequestDto
{
    public string Status { get; set; } = null!;
}
