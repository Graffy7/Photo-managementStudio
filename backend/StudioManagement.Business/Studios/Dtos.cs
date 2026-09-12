namespace StudioManagement.Business.Studios;

public class StudioDto
{
    public int StudioId { get; set; }
    public string StudioName { get; set; } = null!;
    public string? OwnerName { get; set; }
    public string Email { get; set; } = null!;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public string? GstNumber { get; set; }
    public string? Website { get; set; }
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime CreatedAt { get; set; }

    public int? SubscriptionPlanId { get; set; }
    public string? PlanName { get; set; }
    public string? SubscriptionStatus { get; set; }
    public DateTime? SubscriptionStartDate { get; set; }
    public DateTime? SubscriptionEndDate { get; set; }
}

public class CreateStudioRequestDto
{
    public string StudioName { get; set; } = null!;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string OwnerFullName { get; set; } = null!;
    public string OwnerEmail { get; set; } = null!;
    public string OwnerPassword { get; set; } = null!;
    public int SubscriptionPlanId { get; set; }
}

public class UpdateStudioRequestDto
{
    public string StudioName { get; set; } = null!;
    public string? OwnerName { get; set; }
    // Optional so the super-admin's existing studio-edit form (which never sends this field)
    // keeps working unchanged — StudioService only overwrites Email when a value is provided.
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public string? GstNumber { get; set; }
    public string? Website { get; set; }
}
