using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Features;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/studios/{studioId:int}/features")]
[Authorize(Roles = UserTypes.SuperAdmin)]
public class StudioFeaturesController(IFeatureService featureService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetForStudio(int studioId, CancellationToken ct)
    {
        return Ok(await featureService.GetForStudioAsync(studioId, ct));
    }

    [HttpPost("{featureCode}/enable")]
    public async Task<IActionResult> Enable(int studioId, string featureCode, CancellationToken ct)
    {
        var result = await featureService.SetEnabledAsync(studioId, featureCode, true, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{featureCode}/disable")]
    public async Task<IActionResult> Disable(int studioId, string featureCode, CancellationToken ct)
    {
        var result = await featureService.SetEnabledAsync(studioId, featureCode, false, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
