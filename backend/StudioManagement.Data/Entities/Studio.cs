namespace StudioManagement.Data.Entities;

public class Studio
{
    public int StudioId { get; set; }
    public string StudioName { get; set; } = null!;
    public string? OwnerName { get; set; }
    public string Email { get; set; } = null!;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsBlocked { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<StudioSubscription> Subscriptions { get; set; } = new List<StudioSubscription>();
    public ICollection<StudioFeature> StudioFeatures { get; set; } = new List<StudioFeature>();
    public ICollection<StudioSetting> Settings { get; set; } = new List<StudioSetting>();
}
