namespace StudioManagement.Business.Subscriptions;

public class SubscriptionPlanDto
{
    public int SubscriptionPlanId { get; set; }
    public string PlanName { get; set; } = null!;
    public string PlanType { get; set; } = null!;
    public decimal Price { get; set; }
    public int DurationInDays { get; set; }
}
