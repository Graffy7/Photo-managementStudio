using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.Business.PhotoSelection;
using StudioManagement.Data.Repositories;

namespace StudioManagement.API.Controllers;

// The customer's photo-selection page. No login — the private token in the URL is the access, so
// every action re-checks it (valid, not revoked, not expired) and nothing here returns a server
// path or an internal id other than the photo id needed to select a photo.
[ApiController]
[Route("api/public/photo-selection/{token}")]
[AllowAnonymous]
[EnableRateLimiting("public-gallery")]
[ResponseCache(NoStore = true)]
public class PublicPhotoSelectionController(
    IPublicPhotoSelectionService selectionService,
    IValidator<SetSelectionRequestDto> setSelectionValidator) : ControllerBase
{
    private const string ExpiredMessage = "This photo selection link has expired. Please contact the studio.";
    private const string InvalidMessage = "This link is not valid. Please contact the studio for a new link.";
    private const string LockedMessage = "Selection Locked. Your studio has locked this selection. Please contact the studio if you need to make changes.";

    [HttpGet]
    public async Task<IActionResult> Get(string token, CancellationToken ct)
    {
        var result = await selectionService.GetGalleryAsync(token, ct);
        return result.Value is not null ? Ok(result.Value) : AccessDenied(result.Failure!.Value);
    }

    [HttpGet("photos")]
    public async Task<IActionResult> Photos(
        string token,
        [FromQuery] string? filter,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var parsed = Enum.TryParse<PhotoFilter>(filter, ignoreCase: true, out var f) ? f : PhotoFilter.All;
        var result = await selectionService.GetPhotosAsync(token, parsed, search, page, pageSize, ct);
        return result.Value is not null ? Ok(result.Value) : AccessDenied(result.Failure!.Value);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(string token, CancellationToken ct)
    {
        var result = await selectionService.GetSummaryAsync(token, ct);
        return result.Value is not null ? Ok(result.Value) : AccessDenied(result.Failure!.Value);
    }

    // Select a photo (or change its size). One call for both: Normal = 1, Big = 2.
    [HttpPut("photos/{photoId:int}")]
    public async Task<IActionResult> SetSelection(string token, int photoId, SetSelectionRequestDto request, CancellationToken ct)
    {
        var validation = await setSelectionValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        return ToActionResult(await selectionService.SetSelectionAsync(token, photoId, request.SelectionType, ct));
    }

    // Unselect: removes the photo from the selection entirely (no leftover size).
    [HttpDelete("photos/{photoId:int}")]
    public async Task<IActionResult> RemoveSelection(string token, int photoId, CancellationToken ct) =>
        ToActionResult(await selectionService.RemoveSelectionAsync(token, photoId, ct));

    [HttpPost("submit")]
    public async Task<IActionResult> Submit(string token, CancellationToken ct)
    {
        var result = await selectionService.SubmitAsync(token, ct);
        if (result.Succeeded)
        {
            return Ok(result.Result);
        }
        if (result.AccessFailure is { } access)
        {
            return AccessDenied(access);
        }

        return result.FailureReason == SubmitFailureReason.Locked
            ? Conflict(new { code = "locked", message = LockedMessage })
            : BadRequest(new { code = "nothing-selected", message = "Please select at least one photo before submitting." });
    }

    private IActionResult ToActionResult(SelectionResult result)
    {
        if (result.Succeeded)
        {
            return Ok(result.Selection);
        }
        if (result.AccessFailure is { } access)
        {
            return AccessDenied(access);
        }

        return result.FailureReason switch
        {
            SelectionFailureReason.Locked => Conflict(new { code = "locked", message = LockedMessage }),
            SelectionFailureReason.PhotoNotFound => NotFound(new { code = "photo-not-found", message = "That photo wasn't found." }),
            _ => BadRequest(new { code = "invalid-type", message = "SelectionType must be 1 (Normal) or 2 (Big)." })
        };
    }

    // 404 for a dead link, 410 Gone for one that lapsed — so the page can word them differently.
    private ObjectResult AccessDenied(GalleryAccessFailure failure) => failure == GalleryAccessFailure.Expired
        ? StatusCode(StatusCodes.Status410Gone, new { code = "expired", message = ExpiredMessage })
        : NotFound(new { code = "invalid", message = InvalidMessage });
}
