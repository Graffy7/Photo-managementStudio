namespace StudioManagement.Data.Entities;

public class EventType : ITenantEntity, INamedLookup
{
    public int EventTypeId { get; set; }
    public int StudioId { get; set; }
    public string Name { get; set; } = null!;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
}
