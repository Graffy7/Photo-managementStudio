namespace StudioManagement.Data.Entities;

public class StudioFeature : ITenantEntity
{
    public int StudioFeatureId { get; set; }
    public int StudioId { get; set; }
    public int FeatureId { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime? EnabledAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public Feature Feature { get; set; } = null!;
}
