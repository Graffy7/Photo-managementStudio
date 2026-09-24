namespace StudioManagement.Data.Entities;

public class StudioSubscription : ITenantEntity
{
    public int StudioSubscriptionId { get; set; }
    public int StudioId { get; set; }
    public int SubscriptionPlanId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = null!;

    // A free trial the platform admin started; converting it to a paid plan clears this.
    public bool IsTrial { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public SubscriptionPlan SubscriptionPlan { get; set; } = null!;
    public ICollection<SubscriptionPayment> Payments { get; set; } = new List<SubscriptionPayment>();
}
