using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.DayBoard;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/day-board")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class DayBoardController(IDayBoardService dayBoardService, ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> GetDayBoard([FromQuery] DateTime? date, CancellationToken ct)
    {
        var board = await dayBoardService.GetDayBoardAsync(StudioId, date ?? DateTime.UtcNow.Date, ct);
        return Ok(board);
    }

    [HttpGet("month")]
    public async Task<IActionResult> GetMonth([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        if (month is < 1 or > 12)
        {
            return BadRequest(new { message = "Month must be between 1 and 12." });
        }

        var days = await dayBoardService.GetMonthAsync(StudioId, year, month, ct);
        return Ok(days);
    }
}
