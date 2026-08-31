namespace StudioManagement.Data.Entities;

public class PasswordResetToken
{
    public int PasswordResetTokenId { get; set; }
    public int UserId { get; set; }
    public string TokenHash { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UsedAt { get; set; }

    public User User { get; set; } = null!;

    public bool IsActive => UsedAt is null && ExpiresAt > DateTime.UtcNow;
}
