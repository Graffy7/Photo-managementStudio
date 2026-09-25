namespace StudioManagement.Business.Billing;

public class PlanDto
{
    public int PlanId { get; set; }
    public string Name { get; set; } = null!;
    public int Months { get; set; }
    public decimal Price { get; set; }
    public decimal PricePerMonth { get; set; }
    public string? Description { get; set; }

    // Where the subscription would end if bought now (renewals stack onto the current expiry).
    public DateTime NewExpiry { get; set; }
}

public class BillingHistoryItemDto
{
    public string Kind { get; set; } = null!;          // "Online" or "Manual"
    public DateTime Date { get; set; }
    public string? PlanName { get; set; }
    public int Months { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = null!;        // Paid / Failed / Pending
    public string? Method { get; set; }
    public string? TransactionId { get; set; }         // gateway payment id, or the manual reference
    public string? OrderId { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public string? FailureReason { get; set; }
}

public class SubscriptionStatusDto
{
    // Full access (true) or not. AccessLevel says which: Full / ReadOnly / None.
    public bool HasAccess { get; set; }
    public string AccessLevel { get; set; } = null!;
    // Active / Trial / Complimentary / Expired / NoSubscription / ReadOnly (set by the admin) / Suspended / Inactive
    public string Status { get; set; } = null!;
    public bool IsTrial { get; set; }
    public string? PlanName { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public int DaysRemaining { get; set; }
    public decimal? LastAmountPaid { get; set; }
    public string? LastPaymentStatus { get; set; }
    public DateTime? LastPaymentDate { get; set; }
    public bool AutoRenew { get; set; }
    public bool OnlinePaymentsAvailable { get; set; }
    public DateTime ServerTime { get; set; }
    public List<PlanDto> Plans { get; set; } = [];
    public List<BillingHistoryItemDto> History { get; set; } = [];
}

public class CheckoutRequestDto
{
    public int PlanId { get; set; }
}

public class CheckoutDto
{
    public string Gateway { get; set; } = null!;
    public string KeyId { get; set; } = null!;
    public string OrderId { get; set; } = null!;
    public long Amount { get; set; }                   // in paise
    public string Currency { get; set; } = null!;
    public string PlanName { get; set; } = null!;
    public string StudioName { get; set; } = null!;
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class VerifyPaymentRequestDto
{
    public string OrderId { get; set; } = null!;
    public string PaymentId { get; set; } = null!;
    public string Signature { get; set; } = null!;
}

public class PaymentFailedRequestDto
{
    public string OrderId { get; set; } = null!;
    public string? Reason { get; set; }
}
