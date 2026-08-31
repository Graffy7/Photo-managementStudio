namespace StudioManagement.Business.Features;

public interface IFeatureService
{
    Task<List<StudioFeatureDto>> GetForStudioAsync(int studioId, CancellationToken ct = default);
    Task<StudioFeatureDto?> SetEnabledAsync(int studioId, string featureCode, bool isEnabled, CancellationToken ct = default);
    Task<Dictionary<string, bool>> GetMyFeaturesAsync(int studioId, CancellationToken ct = default);
    Task<bool> IsEnabledAsync(int studioId, string featureCode, CancellationToken ct = default);
}
