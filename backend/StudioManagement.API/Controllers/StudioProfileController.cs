using StudioManagement.Business.Common;
using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Studios;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

// A studio-owner-scoped view over the same StudioService the Super Admin's /api/studios already
// uses — this pins studioId to the caller's own tenant rather than taking it from the client, and
// reuses every bit of the existing service (no duplicated profile-update logic).
[ApiController]
[Route("api/studio-profile")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class StudioProfileController(
    IStudioService studioService,
    IStudioProfileExtrasService profileExtras,
    IValidator<UpdateStudioRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private const long MaxLogoSizeBytes = 2 * 1024 * 1024;

    private int StudioId => tenantContext.CurrentStudioId!.Value;

    // Name and logo still show on the "subscription expired" page.
    [AllowWithoutSubscription]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var studio = await studioService.GetByIdAsync(StudioId, ct);
        return studio is null ? NotFound() : Ok(await WithExtrasAsync(studio, ct));
    }

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPut]
    public async Task<IActionResult> Update(UpdateStudioRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        // Website stored in one clean form ("example.com" -> "https://example.com/").
        request.Website = PublicLinks.NormalizeUrl(request.Website);
        var result = await studioService.UpdateAsync(StudioId, request, ct);
        if (result is null || !result.Succeeded)
        {
            // Previously the result object itself came back with 200 even when the update failed.
            return result?.FailureReason == StudioUpdateFailureReason.EmailAlreadyExists
                ? Conflict(new { message = "Another studio already uses this email address." })
                : NotFound();
        }
        var studio = result.Studio!;
        await profileExtras.SaveAsync(StudioId, new StudioProfileExtrasDto
        {
            WhatsAppNumber = request.WhatsAppNumber,
            Description = request.Description,
            InstagramUrl = request.InstagramUrl,
            FacebookUrl = request.FacebookUrl
        }, ct);
        return Ok(await WithExtrasAsync(studio, ct));
    }

    private async Task<StudioDto> WithExtrasAsync(StudioDto studio, CancellationToken ct)
    {
        var extras = await profileExtras.GetAsync(StudioId, ct);
        studio.WhatsAppNumber = extras.WhatsAppNumber;
        studio.Description = extras.Description;
        studio.InstagramUrl = extras.InstagramUrl;
        studio.FacebookUrl = extras.FacebookUrl;
        return studio;
    }

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPost("logo")]
    public async Task<IActionResult> UploadLogo(IFormFile file, CancellationToken ct)
    {
        if (file.Length == 0)
        {
            return BadRequest(new { message = "No file was uploaded." });
        }
        if (file.Length > MaxLogoSizeBytes)
        {
            return BadRequest(new { message = "The logo must be 2MB or smaller." });
        }

        // The bytes must be a real JPG/PNG; what's stored is our own re-encoded copy.
        await using var upload = file.OpenReadStream();
        var (image, error) = await SafeImage.ReencodeAsync(upload, MaxLogoSizeBytes, maxDimension: 1024, ct);
        if (image is null)
        {
            return BadRequest(new { message = error });
        }
        await using var clean = image.Content;
        var studio = await studioService.UploadLogoAsync(StudioId, clean, "logo" + image.Extension, ct);
        return studio is null ? NotFound() : Ok(studio);
    }

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpDelete("logo")]
    public async Task<IActionResult> RemoveLogo(CancellationToken ct)
    {
        var studio = await studioService.RemoveLogoAsync(StudioId, ct);
        return studio is null ? NotFound() : Ok(studio);
    }
}
