using StudioManagement.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Features;
using StudioManagement.Business.Tenant;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/features")]
[Authorize]
// Usable without an active subscription (an expired studio still signs in and renews).
[AllowWithoutSubscription]
public class FeaturesController(IFeatureService featureService, ITenantContext tenantContext) : ControllerBase
{
    [HttpGet("my-features")]
    public async Task<IActionResult> MyFeatures(CancellationToken ct)
    {
        if (tenantContext.CurrentStudioId is not { } studioId)
        {
            return Ok(new Dictionary<string, bool>());
        }

        return Ok(await featureService.GetMyFeaturesAsync(studioId, ct));
    }
}
