using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Admin;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

// The platform admin's console: dashboard figures, the studio table, one studio's details, usage,
// activity, trials and subscription payments. Module switches, block/unblock and studio edits
// keep their existing endpoints (api/studios/...).
[ApiController]
[Route("api/admin")]
[Authorize(Roles = UserTypes.SuperAdmin)]
public class AdminConsoleController(
    IAdminConsoleService consoleService,
    IValidator<TrialDaysRequestDto> trialValidator,
    IValidator<ManualPaymentRequestDto> paymentValidator) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IActionResult> Overview([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct) =>
        Ok(await consoleService.GetOverviewAsync(from, to, ct));

    [HttpGet("studios")]
    public async Task<IActionResult> Studios(
        [FromQuery] string? search, [FromQuery] string? status, [FromQuery] string? plan, [FromQuery] string? sort,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await consoleService.GetStudiosAsync(search, status, plan, sort, page, pageSize, ct));

    [HttpGet("studios/{id:int}")]
    public async Task<IActionResult> Studio(int id, CancellationToken ct) =>
        await consoleService.GetStudioAsync(id, ct) is { } dto ? Ok(dto) : NotFound();

    [HttpGet("studios/{id:int}/usage")]
    public async Task<IActionResult> Usage(int id, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] bool refresh = false, CancellationToken ct = default) =>
        await consoleService.GetUsageAsync(id, from, to, refresh, ct) is { } dto ? Ok(dto) : NotFound();

    [HttpGet("studios/{id:int}/subscription")]
    public async Task<IActionResult> Subscription(int id, CancellationToken ct) =>
        await consoleService.GetSubscriptionAsync(id, ct) is { } dto ? Ok(dto) : NotFound();

    [HttpGet("activity")]
    public async Task<IActionResult> Activity(
        [FromQuery] int? studioId, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? module, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        Ok(await consoleService.GetActivityAsync(studioId, from, to, module, search, page, pageSize, ct));

    [HttpGet("activity/modules")]
    public async Task<IActionResult> ActivityModules([FromQuery] int? studioId, CancellationToken ct) =>
        Ok(await consoleService.GetActivityModulesAsync(studioId, ct));

    [HttpPost("studios/{id:int}/trial/start")]
    public async Task<IActionResult> StartTrial(int id, TrialDaysRequestDto request, CancellationToken ct)
    {
        if (await Invalid(trialValidator, request, ct) is { } bad) return bad;
        return ToResult(await consoleService.StartTrialAsync(id, request.Days, ct));
    }

    [HttpPost("studios/{id:int}/trial/extend")]
    public async Task<IActionResult> ExtendTrial(int id, TrialDaysRequestDto request, CancellationToken ct)
    {
        if (await Invalid(trialValidator, request, ct) is { } bad) return bad;
        return ToResult(await consoleService.ExtendTrialAsync(id, request.Days, ct));
    }

    [HttpPost("studios/{id:int}/trial/end")]
    public async Task<IActionResult> EndTrial(int id, CancellationToken ct) =>
        ToResult(await consoleService.EndTrialAsync(id, ct));

    // Manual payment entry; with months > 0 it also extends (or, from a trial, starts) the paid plan.
    [HttpPost("studios/{id:int}/payments")]
    public async Task<IActionResult> RecordPayment(int id, ManualPaymentRequestDto request, CancellationToken ct)
    {
        if (await Invalid(paymentValidator, request, ct) is { } bad) return bad;
        return ToResult(await consoleService.RecordPaymentAsync(id, request, ct));
    }

    private async Task<IActionResult?> Invalid<T>(IValidator<T> validator, T request, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (validation.IsValid)
        {
            return null;
        }

        foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
        return ValidationProblem(ModelState);
    }

    private IActionResult ToResult(AdminResult result) => result.Succeeded
        ? NoContent()
        : result.Failure switch
        {
            AdminFailure.NotFound => NotFound(),
            AdminFailure.Conflict => Conflict(new { message = result.Message }),
            _ => BadRequest(new { message = result.Message })
        };
}
