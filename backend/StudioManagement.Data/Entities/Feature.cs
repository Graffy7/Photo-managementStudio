namespace StudioManagement.Data.Entities;

public class Feature
{
    public int FeatureId { get; set; }
    public string FeatureCode { get; set; } = null!;
    public string FeatureName { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<StudioFeature> StudioFeatures { get; set; } = new List<StudioFeature>();
}
