namespace StudioManagement.Business.Features;

public class StudioFeatureDto
{
    public int FeatureId { get; set; }
    public string FeatureCode { get; set; } = null!;
    public string FeatureName { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime? EnabledAt { get; set; }
}
