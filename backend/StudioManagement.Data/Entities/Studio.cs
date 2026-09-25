namespace StudioManagement.Data.Entities;

public class Studio
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
    public bool IsActive { get; set; } = true;
    public bool IsBlocked { get; set; }

    // How the platform admin wants access decided (StudioAccessModes): "Auto" follows the
    // subscription; "Full" and "ReadOnly" override it. Suspending is IsBlocked.
    public string AccessMode { get; set; } = "Auto";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<StudioSubscription> Subscriptions { get; set; } = new List<StudioSubscription>();
    public ICollection<StudioFeature> StudioFeatures { get; set; } = new List<StudioFeature>();
    public ICollection<StudioSetting> Settings { get; set; } = new List<StudioSetting>();
}
