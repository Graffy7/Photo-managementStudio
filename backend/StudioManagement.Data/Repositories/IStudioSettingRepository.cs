using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IStudioSettingRepository
{
    Task<List<StudioSetting>> GetAllForStudioAsync(int studioId, CancellationToken ct = default);
    Task UpsertManyAsync(int studioId, Dictionary<string, string?> values, CancellationToken ct = default);

    // One setting across every studio (StudioId -> value), for platform-level checks such as making
    // sure two studios' photo folders never overlap.
    Task<Dictionary<int, string>> GetValuesForKeyAsync(string key, CancellationToken ct = default);
}
