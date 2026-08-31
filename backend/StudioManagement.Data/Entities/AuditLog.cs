namespace StudioManagement.Data.Entities;

public class AuditLog
{
    public long AuditLogId { get; set; }
    public int? StudioId { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = null!;
    public string Module { get; set; } = null!;
    public string EntityName { get; set; } = null!;
    public int? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public DateTime CreatedAt { get; set; }
}
