using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Admin;
using StudioManagement.Business.Audit;
using StudioManagement.Business.PhotoSelection;
using StudioManagement.Data.Repositories;
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
    IValidator<ManualPaymentRequestDto> paymentValidator,
    IStudioPhotoRootService photoRoots,
    IGalleryCleanupService galleryCleanup,
    IStudioRepository studioRepository,
    IAuditService auditService) : ControllerBase
{
    // The one folder a studio's photos may be browsed, imported and copied in. Only the platform
    // admin sets it; no two studios' folders may overlap.
    // Old customer photo links (sent before the 5/10-day rule). GET previews what would change;
    // POST applies it - for one studio (?studioId=) or all. See GalleryCleanupService.CapLegacyLinksAsync.
    [HttpGet("photo-links/legacy")]
    public async Task<IActionResult> PreviewLegacyLinks([FromQuery] int? studioId, CancellationToken ct) =>
        Ok(await galleryCleanup.CapLegacyLinksAsync(studioId, apply: false, DateTime.UtcNow, ct));

    [HttpPost("photo-links/legacy/apply")]
    public async Task<IActionResult> ApplyLegacyLinks([FromQuery] int? studioId, CancellationToken ct) =>
        Ok(await galleryCleanup.CapLegacyLinksAsync(studioId, apply: true, DateTime.UtcNow, ct));

    [HttpGet("studios/{id:int}/photo-root")]
    public async Task<IActionResult> GetPhotoRoot(int id, CancellationToken ct)
    {
        if (await studioRepository.GetByIdAsync(id, ct) is null) return NotFound();
        var info = await photoRoots.GetInfoAsync(id, ct);
        return Ok(new { root = info.Root, setByAdmin = info.SetByAdmin, fromBaseFolder = info.FromBaseFolder });
    }

    [HttpPut("studios/{id:int}/photo-root")]
    public async Task<IActionResult> SetPhotoRoot(int id, PhotoRootRequestDto request, CancellationToken ct)
    {
        if (await studioRepository.GetByIdAsync(id, ct) is null) return NotFound();
        var problem = await photoRoots.SetRootAsync(id, request.Path, ct);
        if (problem != SetPhotoRootProblem.None)
        {
            return BadRequest(new
            {
                message = problem switch
                {
                    SetPhotoRootProblem.NotFound => "That folder doesn't exist on the server.",
                    SetPhotoRootProblem.DriveRoot => "Choose a folder, not a whole drive.",
                    SetPhotoRootProblem.SystemFolder => "System and application folders can't be used.",
                    SetPhotoRootProblem.OverlapsAnotherStudio => "That folder is, contains or sits inside another studio's photo folder.",
                    _ => @"Enter a full folder path, e.g. D:\Studios\Shagul."
                }
            });
        }
        var info = await photoRoots.GetInfoAsync(id, ct);
        await auditService.LogAsync(string.IsNullOrWhiteSpace(request.Path) ? "Photo folder cleared" : "Photo folder set", "PhotoSelection", id, ct);
        return Ok(new { root = info.Root, setByAdmin = info.SetByAdmin, fromBaseFolder = info.FromBaseFolder });
    }

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

    // Every payment on the platform: online checkouts (paid, failed, pending) and manual entries.
    [HttpGet("payments")]
    public async Task<IActionResult> Payments(
        [FromQuery] int? studioId, [FromQuery] string? search, [FromQuery] string? status, [FromQuery] string? kind,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        Ok(await consoleService.GetLedgerAsync(studioId, search, status, kind, from, to, page, pageSize, ct));

    // Free days on top of the current subscription or trial (a lapsed one restarts today).
    [HttpPost("studios/{id:int}/subscription/extend")]
    public async Task<IActionResult> ExtendSubscription(int id, TrialDaysRequestDto request, CancellationToken ct)
    {
        if (await Invalid(trialValidator, request, ct) is { } bad) return bad;
        return ToResult(await consoleService.ExtendSubscriptionAsync(id, request.Days, ct));
    }

    // Ends access now. Nothing is deleted; paying again restores it.
    [HttpPost("studios/{id:int}/subscription/expire")]
    public async Task<IActionResult> ExpireSubscription(int id, CancellationToken ct) =>
        ToResult(await consoleService.ExpireSubscriptionAsync(id, ct));

    // Access control: Auto (follow the subscription), Full or ReadOnly (override), Suspended.
    [HttpPut("studios/{id:int}/access")]
    public async Task<IActionResult> SetAccess(int id, AccessModeRequestDto request, CancellationToken ct) =>
        ToResult(await consoleService.SetAccessModeAsync(id, request.Mode ?? "", ct));

    [HttpPut("studios/{id:int}/subscription/plan")]
    public async Task<IActionResult> ChangePlan(int id, ChangePlanRequestDto request, CancellationToken ct) =>
        ToResult(await consoleService.ChangePlanAsync(id, request.PlanId, ct));

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
