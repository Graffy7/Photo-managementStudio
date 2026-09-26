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

    // The owner's actual login account. LoginEmail is what they type on the login page, which is what
    // the super admin needs to see — Studio.Email above is only the studio's contact address.
    public int? OwnerUserId { get; set; }
    public string? LoginEmail { get; set; }
    public bool OwnerIsActive { get; set; }
    public DateTime? OwnerLastLoginAt { get; set; }

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
    // Paid plan to start with (ignored for a free trial).
    public int SubscriptionPlanId { get; set; }

    // Free use for a set period instead of a plan: From/To are calendar dates (both included).
    public bool FreeTrial { get; set; }
    public DateTime? TrialStartDate { get; set; }
    public DateTime? TrialEndDate { get; set; }
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

// Super admin setting a new password for a studio owner (for example when they are locked out).
// The existing password can never be read back — it is stored only as a one-way hash.
public class ResetStudioPasswordRequestDto
{
    public string NewPassword { get; set; } = null!;
}
