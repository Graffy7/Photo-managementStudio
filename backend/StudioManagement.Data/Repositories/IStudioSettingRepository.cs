using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IStudioSettingRepository
{
    Task<List<StudioSetting>> GetAllForStudioAsync(int studioId, CancellationToken ct = default);
    Task UpsertManyAsync(int studioId, Dictionary<string, string?> values, CancellationToken ct = default);
}
