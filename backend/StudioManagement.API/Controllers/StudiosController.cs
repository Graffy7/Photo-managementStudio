using StudioManagement.Business.Billing;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Studios;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/studios")]
[Authorize(Roles = UserTypes.SuperAdmin)]
public class StudiosController(
    IStudioService studioService,
    IValidator<CreateStudioRequestDto> createValidator,
    IValidator<UpdateStudioRequestDto> updateValidator,
    IValidator<ResetStudioPasswordRequestDto> resetPasswordValidator,
    IStudioAccessService accessService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? search, [FromQuery] bool? isActive, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await studioService.SearchAsync(search, isActive, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var studio = await studioService.GetByIdAsync(id, ct);
        return studio is null ? NotFound() : Ok(studio);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateStudioRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await studioService.CreateAsync(request, ct);
        if (!result.Succeeded)
        {
            return Conflict(new { message = "A studio or user with this email already exists." });
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Studio!.StudioId }, result.Studio);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateStudioRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await studioService.UpdateAsync(id, request, ct);
        if (result.Succeeded)
        {
            return Ok(result.Studio);
        }

        return result.FailureReason == StudioUpdateFailureReason.NotFound
            ? NotFound()
            : Conflict(new { message = "Another studio or user already uses that email address." });
    }


    // Sets a new password for this studio's owner. The current password cannot be shown anywhere in the
    // app — it is stored only as a one-way hash — so the super admin replaces it and tells the owner.
    [HttpPost("{id:int}/reset-owner-password")]
    public async Task<IActionResult> ResetOwnerPassword(int id, ResetStudioPasswordRequestDto request, CancellationToken ct)
    {
        var validation = await resetPasswordValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await studioService.ResetOwnerPasswordAsync(id, request.NewPassword, ct);
        if (result.Succeeded)
        {
            return Ok(new { loginEmail = result.LoginEmail, message = "Password updated. Give the new password to the studio owner." });
        }

        return result.FailureReason == PasswordResetFailureReason.StudioNotFound
            ? NotFound()
            : BadRequest(new { message = "This studio has no owner login account." });
    }
    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct)
    {
        var studio = await studioService.SetActiveAsync(id, true, ct);
        accessService.Invalidate(id);   // takes effect on the studio's next request
        return studio is null ? NotFound() : Ok(studio);
    }

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        var studio = await studioService.SetActiveAsync(id, false, ct);
        accessService.Invalidate(id);   // takes effect on the studio's next request
        return studio is null ? NotFound() : Ok(studio);
    }

    [HttpPost("{id:int}/block")]
    public async Task<IActionResult> Block(int id, CancellationToken ct)
    {
        var studio = await studioService.SetBlockedAsync(id, true, ct);
        accessService.Invalidate(id);   // takes effect on the studio's next request
        return studio is null ? NotFound() : Ok(studio);
    }

    [HttpPost("{id:int}/unblock")]
    public async Task<IActionResult> Unblock(int id, CancellationToken ct)
    {
        var studio = await studioService.SetBlockedAsync(id, false, ct);
        accessService.Invalidate(id);   // takes effect on the studio's next request
        return studio is null ? NotFound() : Ok(studio);
    }
}
