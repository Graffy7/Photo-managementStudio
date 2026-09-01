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
}
