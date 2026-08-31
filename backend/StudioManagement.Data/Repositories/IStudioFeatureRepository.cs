using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IStudioFeatureRepository : IRepository<StudioFeature>
{
    Task<List<StudioFeature>> GetByStudioIdAsync(int studioId, CancellationToken ct = default);
    Task<StudioFeature?> FindAsync(int studioId, int featureId, CancellationToken ct = default);
}
