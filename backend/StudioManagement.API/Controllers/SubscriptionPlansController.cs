using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Subscriptions;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/subscription-plans")]
[Authorize(Roles = UserTypes.SuperAdmin)]
public class SubscriptionPlansController(ISubscriptionPlanService subscriptionPlanService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        return Ok(await subscriptionPlanService.GetActivePlansAsync(ct));
    }
}
