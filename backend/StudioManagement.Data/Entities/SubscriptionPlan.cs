namespace StudioManagement.Data.Entities;

public class SubscriptionPlan
{
    public int SubscriptionPlanId { get; set; }
    public string PlanName { get; set; } = null!;
    public string PlanType { get; set; } = null!;
    public decimal Price { get; set; }
    public int DurationInDays { get; set; }

    // What the plan buys, in calendar months: expiry is start + this many months (so 31 Jan + 1
    // month is 28/29 Feb, not "30 days"). 0 for plans that aren't sold by the month.
    public int DurationMonths { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<StudioSubscription> StudioSubscriptions { get; set; } = new List<StudioSubscription>();
}
