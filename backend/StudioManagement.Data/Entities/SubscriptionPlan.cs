namespace StudioManagement.Data.Entities;

public class SubscriptionPlan
{
    public int SubscriptionPlanId { get; set; }
    public string PlanName { get; set; } = null!;
    public string PlanType { get; set; } = null!;
    public decimal Price { get; set; }
    public int DurationInDays { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<StudioSubscription> StudioSubscriptions { get; set; } = new List<StudioSubscription>();
}
