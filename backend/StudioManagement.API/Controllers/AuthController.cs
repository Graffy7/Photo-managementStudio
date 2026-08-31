using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Tenant;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    IAuthService authService,
    IPasswordResetService passwordResetService,
    IValidator<LoginRequestDto> loginValidator,
    IValidator<RefreshRequestDto> refreshValidator,
    IValidator<LogoutRequestDto> logoutValidator,
    IValidator<ForgotPasswordRequestDto> forgotPasswordValidator,
    IValidator<ResetPasswordRequestDto> resetPasswordValidator,
    IValidator<ChangePasswordRequestDto> changePasswordValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private string? ClientIp => HttpContext.Connection.RemoteIpAddress?.ToString();

    private async Task<IActionResult?> ValidateAsync<T>(IValidator<T> validator, T request, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(request, ct);
        if (validation.IsValid)
        {
            return null;
        }
        foreach (var error in validation.Errors)
        {
            ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
        }
        return ValidationProblem(ModelState);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(loginValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        var result = await authService.LoginAsync(request, ClientIp, ct);
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

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh(RefreshRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(refreshValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        var result = await authService.RefreshAsync(request.RefreshToken, ClientIp, ct);
        if (!result.Succeeded)
        {
            return Unauthorized(new { message = "Your session has expired. Please sign in again." });
        }

        return Ok(result.Response);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(LogoutRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(logoutValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        await authService.LogoutAsync(request.RefreshToken, ct);
        return NoContent();
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(forgotPasswordValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        await passwordResetService.RequestResetAsync(request.Email, ct);
        return Ok(new { message = "If an account exists for that email, we've sent password reset instructions." });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(resetPasswordValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        var result = await passwordResetService.ResetPasswordAsync(request.Token, request.NewPassword, ct);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = "This reset code is invalid or has expired. Request a new one." });
        }

        return Ok(new { message = "Your password has been reset. Please sign in with your new password." });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(changePasswordValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        var result = await authService.ChangePasswordAsync(tenantContext.CurrentUserId!.Value, request, ct);
        if (!result.Succeeded)
        {
            return result.FailureReason switch
            {
                ChangePasswordFailureReason.IncorrectCurrentPassword => BadRequest(new { message = "Current password is incorrect." }),
                _ => BadRequest(new { message = "New password and confirmation do not match." })
            };
        }

        return Ok(new { message = "Password changed. Please sign in again." });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var profile = await authService.GetProfileAsync(tenantContext.CurrentUserId!.Value, ct);
        return profile is null ? NotFound() : Ok(profile);
    }
}
