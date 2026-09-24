namespace StudioManagement.Data.Entities;

public class SubscriptionPayment
{
    public int SubscriptionPaymentId { get; set; }
    public int StudioSubscriptionId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }

    // The subscription period this payment bought. Null on payments recorded before this was kept.
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public DateTime CreatedAt { get; set; }

    public StudioSubscription StudioSubscription { get; set; } = null!;
}
