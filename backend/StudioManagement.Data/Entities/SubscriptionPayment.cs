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
    public DateTime CreatedAt { get; set; }

    public StudioSubscription StudioSubscription { get; set; } = null!;
}
