using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class StudioFeatureRepository(AppDbContext context) : Repository<StudioFeature>(context), IStudioFeatureRepository
{
    public Task<List<StudioFeature>> GetByStudioIdAsync(int studioId, CancellationToken ct = default) =>
        Set.Include(sf => sf.Feature).Where(sf => sf.StudioId == studioId).ToListAsync(ct);

    public Task<StudioFeature?> FindAsync(int studioId, int featureId, CancellationToken ct = default) =>
        Set.FirstOrDefaultAsync(sf => sf.StudioId == studioId && sf.FeatureId == featureId, ct);
}
