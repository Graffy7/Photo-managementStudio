using StudioManagement.Business.Audit;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Features;

public class FeatureService(
    IRepository<Feature> featureRepository,
    IStudioFeatureRepository studioFeatureRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IFeatureService
{
    private const string Module = "Features";

    public async Task<List<StudioFeatureDto>> GetForStudioAsync(int studioId, CancellationToken ct = default)
    {
        var allFeatures = (await featureRepository.GetAllAsync(ct)).Where(f => f.IsActive).OrderBy(f => f.FeatureName).ToList();
        var studioFeatures = await studioFeatureRepository.GetByStudioIdAsync(studioId, ct);
        var byFeatureId = studioFeatures.ToDictionary(sf => sf.FeatureId);

        return allFeatures.Select(f =>
        {
            byFeatureId.TryGetValue(f.FeatureId, out var studioFeature);
            return new StudioFeatureDto
            {
                FeatureId = f.FeatureId,
                FeatureCode = f.FeatureCode,
                FeatureName = f.FeatureName,
                Description = f.Description,
                // No row yet means the feature has never been touched for this studio — default to enabled.
                IsEnabled = studioFeature?.IsEnabled ?? true,
                EnabledAt = studioFeature?.EnabledAt
            };
        }).ToList();
    }

    public async Task<StudioFeatureDto?> SetEnabledAsync(int studioId, string featureCode, bool isEnabled, CancellationToken ct = default)
    {
        var feature = (await featureRepository.GetAllAsync(ct)).FirstOrDefault(f => f.FeatureCode == featureCode);
        if (feature is null)
        {
            return null;
        }

        var studioFeature = await studioFeatureRepository.FindAsync(studioId, feature.FeatureId, ct);
        var now = DateTime.UtcNow;

        if (studioFeature is null)
        {
            studioFeature = new StudioFeature
            {
                StudioId = studioId,
                FeatureId = feature.FeatureId,
                IsEnabled = isEnabled,
                EnabledAt = isEnabled ? now : null,
                UpdatedAt = now
            };
            await studioFeatureRepository.AddAsync(studioFeature, ct);
        }
        else
        {
            studioFeature.IsEnabled = isEnabled;
            studioFeature.EnabledAt = isEnabled ? now : studioFeature.EnabledAt;
            studioFeature.UpdatedAt = now;
            studioFeatureRepository.Update(studioFeature);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"{feature.FeatureName} {(isEnabled ? "enabled" : "disabled")}", Module, studioId, ct);

        return new StudioFeatureDto
        {
            FeatureId = feature.FeatureId,
            FeatureCode = feature.FeatureCode,
            FeatureName = feature.FeatureName,
            Description = feature.Description,
            IsEnabled = studioFeature.IsEnabled,
            EnabledAt = studioFeature.EnabledAt
        };
    }

    public async Task<Dictionary<string, bool>> GetMyFeaturesAsync(int studioId, CancellationToken ct = default)
    {
        var features = await GetForStudioAsync(studioId, ct);
        return features.ToDictionary(f => f.FeatureCode, f => f.IsEnabled);
    }

    public async Task<bool> IsEnabledAsync(int studioId, string featureCode, CancellationToken ct = default)
    {
        var features = await GetMyFeaturesAsync(studioId, ct);
        return features.TryGetValue(featureCode, out var enabled) && enabled;
    }
}
