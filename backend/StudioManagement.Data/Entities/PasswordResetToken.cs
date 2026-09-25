namespace StudioManagement.Data.Entities;

public class PasswordResetToken
{
    public int PasswordResetTokenId { get; set; }
    public int UserId { get; set; }
    public string TokenHash { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UsedAt { get; set; }

    // "Email" / "Phone" = a 6-digit sign-in code sent that way (PasswordResetChannels);
    // null = a long reset token (issued once a code is verified, or by the old email-link flow).
    public string? Channel { get; set; }
    // Wrong codes typed against this entry; it is burned once the limit is reached.
    public int FailedAttempts { get; set; }

    public User User { get; set; } = null!;

    public bool IsActive => UsedAt is null && ExpiresAt > DateTime.UtcNow;
}
