using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Subscriptions;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/studios/{studioId:int}/subscription")]
[Authorize(Roles = UserTypes.SuperAdmin)]
public class SubscriptionsController(
    ISubscriptionService subscriptionService,
    IValidator<RenewSubscriptionRequestDto> renewValidator) : ControllerBase
{
    [HttpPost("renew")]
    public async Task<IActionResult> Renew(int studioId, RenewSubscriptionRequestDto request, CancellationToken ct)
    {
        var validation = await renewValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var studio = await subscriptionService.RenewAsync(studioId, request, ct);
        return studio is null ? NotFound() : Ok(studio);
    }

    [HttpGet("payments")]
    public async Task<IActionResult> GetPaymentHistory(int studioId, CancellationToken ct)
    {
        var payments = await subscriptionService.GetPaymentHistoryAsync(studioId, ct);
        return payments is null ? NotFound() : Ok(payments);
    }
}
