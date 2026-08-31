namespace StudioManagement.Data.Entities;

public class Notification : ITenantEntity
{
    public int NotificationId { get; set; }
    public int StudioId { get; set; }
    public int? UserId { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string NotificationType { get; set; } = null!;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public User? User { get; set; }
}
