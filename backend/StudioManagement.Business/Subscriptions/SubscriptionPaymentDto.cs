namespace StudioManagement.Business.Subscriptions;

public class SubscriptionPaymentDto
{
    public int SubscriptionPaymentId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
}

public class RenewSubscriptionRequestDto
{
    public int? SubscriptionPlanId { get; set; }
    public string PaymentMethod { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
}
