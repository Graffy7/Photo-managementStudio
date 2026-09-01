using StudioManagement.Business.Common;

namespace StudioManagement.Business.Dashboard;

public interface IStudioDashboardService
{
    Task<StudioDashboardSummaryDto> GetSummaryAsync(int studioId, DateRangePreset preset, DateTime? customStart, DateTime? customEnd, CancellationToken ct = default);
}
