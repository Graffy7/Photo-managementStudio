using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Common;
using StudioManagement.Business.Dashboard;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/studio-dashboard")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class StudioDashboardController(IStudioDashboardService studioDashboardService, ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateRangePreset preset = DateRangePreset.ThisMonth,
        [FromQuery] DateTime? customStart = null,
        [FromQuery] DateTime? customEnd = null,
        CancellationToken ct = default)
    {
        if (preset == DateRangePreset.Custom && (customStart is null || customEnd is null))
        {
            return BadRequest(new { message = "customStart and customEnd are required when preset is Custom." });
        }

        var summary = await studioDashboardService.GetSummaryAsync(StudioId, preset, customStart, customEnd, ct);
        return Ok(summary);
    }
}
