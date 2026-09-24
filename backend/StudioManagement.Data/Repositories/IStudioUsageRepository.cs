using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public record UsageIncrement(int StudioId, DateTime UsageDate, int ActiveMinutes, int RequestCount, DateTime LastSeenAt);

public interface IStudioUsageRepository
{
    // Adds the counted minutes/requests onto each (studio, day) row, creating rows as needed.
    Task AddAsync(IReadOnlyCollection<UsageIncrement> increments, CancellationToken ct = default);

    Task<List<StudioDailyUsage>> GetForStudioAsync(int studioId, DateTime fromDate, DateTime toDate, CancellationToken ct = default);

    // Most recent activity per studio.
    Task<Dictionary<int, DateTime>> GetLastSeenAsync(CancellationToken ct = default);
}
