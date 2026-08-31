namespace StudioManagement.Data.Entities;

public class LeadSource : ITenantEntity
{
    public int LeadSourceId { get; set; }
    public int StudioId { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
}
