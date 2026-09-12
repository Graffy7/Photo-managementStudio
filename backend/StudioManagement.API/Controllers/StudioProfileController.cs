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
public class StudioProfileController(IStudioService studioService, IValidator<UpdateStudioRequestDto> updateValidator, ITenantContext tenantContext) : ControllerBase
{
    private static readonly HashSet<string> AllowedLogoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp"
    };
    private const long MaxLogoSizeBytes = 2 * 1024 * 1024;

    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var studio = await studioService.GetByIdAsync(StudioId, ct);
        return studio is null ? NotFound() : Ok(studio);
    }

    [HttpPut]
    public async Task<IActionResult> Update(UpdateStudioRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var studio = await studioService.UpdateAsync(StudioId, request, ct);
        return studio is null ? NotFound() : Ok(studio);
    }

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
        if (!AllowedLogoContentTypes.Contains(file.ContentType))
        {
            return BadRequest(new { message = "The logo must be a JPG, PNG, or WEBP image." });
        }

        await using var stream = file.OpenReadStream();
        var studio = await studioService.UploadLogoAsync(StudioId, stream, file.FileName, ct);
        return studio is null ? NotFound() : Ok(studio);
    }

    [HttpDelete("logo")]
    public async Task<IActionResult> RemoveLogo(CancellationToken ct)
    {
        var studio = await studioService.RemoveLogoAsync(StudioId, ct);
        return studio is null ? NotFound() : Ok(studio);
    }
}
