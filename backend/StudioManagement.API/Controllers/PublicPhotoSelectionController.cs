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
[EnableRateLimiting("auth")]
public class PublicPhotoSelectionController(
    IPhotoSelectionService photoSelectionService,
    IPhotoService photoService,
    IValidator<UnlockRequestDto> unlockValidator,
    IValidator<SetSelectionRequestDto> setSelectionValidator) : ControllerBase
{
    private const string PinHeaderName = "X-Selection-Pin";

    private async Task<int?> ResolveAsync(string token, CancellationToken ct)
    {
        var projectId = await photoSelectionService.ResolveProjectIdAsync(token, ct);
        if (projectId is null)
        {
            return null;
        }

        Request.Headers.TryGetValue(PinHeaderName, out var pin);
        var allowed = await photoSelectionService.ValidateAccessAsync(projectId.Value, pin.FirstOrDefault(), ct);
        return allowed ? projectId : null;
    }

    [HttpPost("unlock")]
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
        var projectId = await ResolveAsync(token, ct);
        if (projectId is null)
        {
            return NotFound();
        }

        await photoSelectionService.RecordFirstOpenAsync(projectId.Value, ct);
        var summary = await photoSelectionService.GetPublicSummaryAsync(projectId.Value, ct);
        return summary is null ? NotFound() : Ok(summary);
    }

    [HttpGet("photos")]
    public async Task<IActionResult> GetPhotos(string token, [FromQuery] int? cursor, [FromQuery] int limit, CancellationToken ct)
    {
        var projectId = await ResolveAsync(token, ct);
        if (projectId is null)
        {
            return NotFound();
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

        var projectId = await ResolveAsync(token, ct);
        if (projectId is null)
        {
            return NotFound();
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
        var projectId = await ResolveAsync(token, ct);
        if (projectId is null)
        {
            return NotFound();
        }

        var result = await photoSelectionService.SubmitAsync(projectId.Value, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
