using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Common;
using StudioManagement.Business.Reports;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Reports)]
public class ReportsController(IProfitReportService profitReportService, IAnalyticsReportService analyticsService, ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    // A custom range needs both dates, the start no later than the end, and at most 5 years.
    private static string? CheckCustomRange(DateRangePreset preset, DateTime? customStart, DateTime? customEnd)
    {
        if (preset != DateRangePreset.Custom) return null;
        if (customStart is null || customEnd is null) return "Choose both a start date and an end date.";
        if (customStart.Value.Date > customEnd.Value.Date) return "The start date can't be after the end date.";
        if (customEnd.Value.Date > customStart.Value.Date.AddYears(5)) return "Choose a range of at most 5 years.";
        return null;
    }

    // Analytics for one date range: cards, day/month figures, event types, statuses, insights and
    // the profit breakdown, all from one consistent read. Always the signed-in studio's own data.
    [HttpGet("analytics")]
    [EnableRateLimiting("expensive")]
    public async Task<IActionResult> GetAnalytics(
        [FromQuery] DateRangePreset preset = DateRangePreset.Last1Month,
        [FromQuery] DateTime? customStart = null,
        [FromQuery] DateTime? customEnd = null,
        CancellationToken ct = default)
    {
        var problem = CheckCustomRange(preset, customStart, customEnd);
        if (problem is not null) return BadRequest(new { message = problem });
        return Ok(await analyticsService.GetAsync(StudioId, preset, customStart, customEnd, ct));
    }

    [HttpGet("analytics/export")]
    [EnableRateLimiting("expensive")]
    public async Task<IActionResult> ExportAnalytics(
        [FromQuery] DateRangePreset preset = DateRangePreset.Last1Month,
        [FromQuery] DateTime? customStart = null,
        [FromQuery] DateTime? customEnd = null,
        CancellationToken ct = default)
    {
        var problem = CheckCustomRange(preset, customStart, customEnd);
        if (problem is not null) return BadRequest(new { message = problem });
        var report = await analyticsService.GetAsync(StudioId, preset, customStart, customEnd, ct);
        var name = $"studio-report-{report.RangeStart:yyyy-MM-dd}-to-{report.RangeLastDay:yyyy-MM-dd}.csv";
        return File(AnalyticsCsv.Build(report), "text/csv; charset=utf-8", name);
    }

    [HttpGet("profit")]
    [EnableRateLimiting("expensive")]
    public async Task<IActionResult> GetProfitReport(
        [FromQuery] DateRangePreset preset = DateRangePreset.ThisMonth,
        [FromQuery] DateTime? customStart = null,
        [FromQuery] DateTime? customEnd = null,
        CancellationToken ct = default)
    {
        if (preset == DateRangePreset.Custom && (customStart is null || customEnd is null))
        {
            return BadRequest(new { message = "customStart and customEnd are required when preset is Custom." });
        }

        var report = await profitReportService.GetProfitReportAsync(StudioId, preset, customStart, customEnd, ct);
        return Ok(report);
    }
}
