namespace StudioManagement.Data.Entities;

// One online checkout a studio started for a plan: the gateway's order, what it cost, and what
// happened to it. Kept permanently as the transaction record. Nothing sensitive is stored - card
// numbers, CVVs and UPI PINs never reach this server (the gateway's own checkout collects them).
public class SubscriptionOrder
{
    public int SubscriptionOrderId { get; set; }
    public int StudioId { get; set; }
    public int SubscriptionPlanId { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public int Months { get; set; }

    public string Gateway { get; set; } = null!;          // e.g. "Razorpay"
    public string GatewayOrderId { get; set; } = null!;   // the gateway's order id (unique)
    public string? GatewayPaymentId { get; set; }         // set once paid (unique)
    public string? PaymentMethod { get; set; }            // upi / card / netbanking / wallet ... as the gateway reports it

    public string Status { get; set; } = null!;           // PaymentOrderStatuses
    public string? FailureReason { get; set; }

    // The subscription payment this order turned into (exactly one, once Paid).
    public int? SubscriptionPaymentId { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public SubscriptionPlan SubscriptionPlan { get; set; } = null!;
    public SubscriptionPayment? SubscriptionPayment { get; set; }
}

// Every webhook the gateway sent, by its event id: a replayed or duplicated delivery is recognised
// and ignored, and the history shows what the gateway told us and when.
public class PaymentGatewayEvent
{
    public long PaymentGatewayEventId { get; set; }
    public string Gateway { get; set; } = null!;
    public string EventId { get; set; } = null!;
    public string EventType { get; set; } = null!;
    public string? GatewayOrderId { get; set; }
    public string? GatewayPaymentId { get; set; }
    public string Outcome { get; set; } = null!;
    public DateTime ReceivedAt { get; set; }
}
