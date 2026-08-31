using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Tenant;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService, IValidator<LoginRequestDto> loginValidator, ITenantContext tenantContext) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(LoginRequestDto request, CancellationToken ct)
    {
        var validation = await loginValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors)
            {
                ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            }
            return ValidationProblem(ModelState);
        }

        var result = await authService.LoginAsync(request, ct);
        if (!result.Succeeded)
        {
            return result.FailureReason switch
            {
                AuthFailureReason.StudioBlocked => StatusCode(StatusCodes.Status403Forbidden, new { message = "This studio has been blocked. Contact support." }),
                AuthFailureReason.StudioInactive => StatusCode(StatusCodes.Status403Forbidden, new { message = "This studio is not active." }),
                _ => Unauthorized(new { message = "Invalid email or password." })
            };
        }

        return Ok(result.Response);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var profile = await authService.GetProfileAsync(tenantContext.CurrentUserId!.Value, ct);
        return profile is null ? NotFound() : Ok(profile);
    }
}
