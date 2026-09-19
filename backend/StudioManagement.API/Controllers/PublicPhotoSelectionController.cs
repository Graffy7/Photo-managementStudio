using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.Business.PhotoSelection;

namespace StudioManagement.API.Controllers;

// Deliberately anonymous and studio-agnostic — the URL token is the only credential. Every
// action re-derives the project from the token (never trusts anything else in the request) and,
// if the project has a PIN configured, re-checks it on every single call — not just once at
// "unlock" — since a PIN that only gates one endpoint isn't actually protecting anything.
[ApiController]
[Route("api/public/photo-selection/{token}")]
[AllowAnonymous]
// The gallery itself needs headroom (every selection refetches the summary and photo list), so it
// gets the generous "public-gallery" policy; only Unlock — the PIN guess endpoint — keeps the strict one.
[EnableRateLimiting("public-gallery")]
public class PublicPhotoSelectionController(
    IPhotoSelectionService photoSelectionService,
    IPhotoService photoService,
    IValidator<UnlockRequestDto> unlockValidator,
    IValidator<SetSelectionRequestDto> setSelectionValidator) : ControllerBase
{
    private const string PinHeaderName = "X-Selection-Pin";

    // A token that doesn't resolve (wrong, revoked, expired) is 404 and says nothing more. A token
    // that DOES resolve but arrives without the right PIN is 401 — the page needs that to know it
    // should ask for the PIN rather than report a dead link. Only someone already holding the
    // (256-bit) token can learn a PIN is required, so nothing is leaked.
    private async Task<(int? ProjectId, IActionResult? Failure)> ResolveAsync(string token, CancellationToken ct)
    {
        var projectId = await photoSelectionService.ResolveProjectIdAsync(token, ct);
        if (projectId is null)
        {
            return (null, NotFound());
        }

        Request.Headers.TryGetValue(PinHeaderName, out var pin);
        var allowed = await photoSelectionService.ValidateAccessAsync(projectId.Value, pin.FirstOrDefault(), ct);
        return allowed ? (projectId, null) : (null, Unauthorized(new { message = "A PIN is required to open this gallery." }));
    }

    [HttpPost("unlock")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Unlock(string token, UnlockRequestDto request, CancellationToken ct)
    {
        var validation = await unlockValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var projectId = await photoSelectionService.ResolveProjectIdAsync(token, ct);
        if (projectId is null)
        {
            return NotFound();
        }

        var ok = await photoSelectionService.ValidateAccessAsync(projectId.Value, request.Pin, ct);
        return ok ? Ok(new { message = "Unlocked." }) : Unauthorized(new { message = "Incorrect PIN." });
    }

    [HttpGet]
    public async Task<IActionResult> GetSummary(string token, CancellationToken ct)
    {
        var (projectId, failure) = await ResolveAsync(token, ct);
        if (failure is not null)
        {
            return failure;
        }

        await photoSelectionService.RecordFirstOpenAsync(projectId.Value, ct);
        var summary = await photoSelectionService.GetPublicSummaryAsync(projectId.Value, ct);
        return summary is null ? NotFound() : Ok(summary);
    }

    [HttpGet("photos")]
    public async Task<IActionResult> GetPhotos(string token, [FromQuery] int? cursor, [FromQuery] int limit, CancellationToken ct)
    {
        var (projectId, failure) = await ResolveAsync(token, ct);
        if (failure is not null)
        {
            return failure;
        }

        limit = limit is < 1 or > 100 ? 50 : limit;
        var photos = await photoService.GetPhotosAsync(projectId.Value, cursor, limit, ct);
        // Never leak local filesystem details to the public gallery — only the fields a
        // customer needs to browse and select.
        var publicPhotos = photos.Select(p => new PublicPhotoDto
        {
            PhotoId = p.PhotoId,
            PhotoNumber = p.PhotoNumber,
            ThumbnailUrl = p.ThumbnailUrl,
            PreviewUrl = p.PreviewUrl,
            SelectionType = p.SelectionType
        });
        return Ok(publicPhotos);
    }

    [HttpPut("photos/{photoId:int}/selection")]
    public async Task<IActionResult> SetSelection(string token, int photoId, SetSelectionRequestDto request, CancellationToken ct)
    {
        var validation = await setSelectionValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var (projectId, failure) = await ResolveAsync(token, ct);
        if (failure is not null)
        {
            return failure;
        }

        var result = await photoService.SetSelectionAsync(projectId.Value, photoId, request.SelectionType, ct);
        if (!result.Succeeded)
        {
            return result.FailureReason switch
            {
                SetSelectionFailureReason.PhotoNotFound => NotFound(),
                SetSelectionFailureReason.ProjectLocked => Conflict(new { message = "This selection has already been submitted." }),
                SetSelectionFailureReason.LimitExceeded => Conflict(new { message = "That selection limit has already been reached." }),
                _ => BadRequest(new { message = "Invalid request." })
            };
        }

        // Same rule as GetPhotos: the public response never carries the original filename/path.
        var photo = result.Photo!;
        return Ok(new PublicPhotoDto
        {
            PhotoId = photo.PhotoId,
            PhotoNumber = photo.PhotoNumber,
            ThumbnailUrl = photo.ThumbnailUrl,
            PreviewUrl = photo.PreviewUrl,
            SelectionType = photo.SelectionType
        });
    }

    [HttpPost("submit")]
    public async Task<IActionResult> Submit(string token, CancellationToken ct)
    {
        var (projectId, failure) = await ResolveAsync(token, ct);
        if (failure is not null)
        {
            return failure;
        }

        var result = await photoSelectionService.SubmitAsync(projectId.Value, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
