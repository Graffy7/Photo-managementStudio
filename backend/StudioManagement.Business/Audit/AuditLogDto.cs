namespace StudioManagement.Business.Audit;

public class AuditLogDto
{
    public long AuditLogId { get; set; }
    public string Action { get; set; } = null!;
    public string Module { get; set; } = null!;
    public int? StudioId { get; set; }
    public string? StudioName { get; set; }
    public int? UserId { get; set; }
    public string? ActorName { get; set; }
    public DateTime CreatedAt { get; set; }
}
