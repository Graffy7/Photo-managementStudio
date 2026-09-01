using StudioManagement.Business.Common;

namespace StudioManagement.Business.Reports;

public interface IProfitReportService
{
    Task<ProfitReportDto> GetProfitReportAsync(int studioId, DateRangePreset preset, DateTime? customStart, DateTime? customEnd, CancellationToken ct = default);
}
