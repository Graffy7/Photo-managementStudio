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
public class ReportsController(IProfitReportService profitReportService, ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet("profit")]
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
