using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Tenant;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/auth")]
// Usable without an active subscription (an expired studio still signs in and renews).
[AllowWithoutSubscription]
public class AuthController(
    IAuthService authService,
    IPasswordResetService passwordResetService,
    IRefreshTokenService refreshTokenService,
    IValidator<LoginRequestDto> loginValidator,
    ILoginThrottle loginThrottle,
    IValidator<RefreshRequestDto> refreshValidator,
    IValidator<LogoutRequestDto> logoutValidator,
    IValidator<ForgotPasswordRequestDto> forgotPasswordValidator,
    IValidator<ResetPasswordRequestDto> resetPasswordValidator,
    IValidator<SendResetCodeRequestDto> sendResetCodeValidator,
    IValidator<VerifyResetCodeRequestDto> verifyResetCodeValidator,
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
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(loginValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        // Failed-attempt limits per account and per connection (LoginThrottle); checked before the
        // password is even looked at, so a locked account can't be probed further.
        if (loginThrottle.RetryAfter(request.Email, ClientIp) is { } wait)
        {
            var minutes = Math.Max(1, (int)Math.Ceiling(wait.TotalMinutes));
            Response.Headers.RetryAfter = ((int)Math.Ceiling(wait.TotalSeconds)).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                code = "TOO_MANY_ATTEMPTS",
                message = $"Too many wrong passwords. Try again in {minutes} minute{(minutes == 1 ? "" : "s")}, or use Forgot password."
            });
        }

        var result = await authService.LoginAsync(request, ClientIp, ct);
        if (result.Succeeded)
        {
            loginThrottle.RecordSuccess(request.Email, ClientIp);
        }
        else if (result.FailureReason is not AuthFailureReason.StudioBlocked and not AuthFailureReason.StudioInactive)
        {
            loginThrottle.RecordFailure(request.Email, ClientIp);
        }
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

    // What the Forgot password screen can offer (phone only once an SMS provider is set up).
    [HttpGet("forgot-password/options")]
    [AllowAnonymous]
    public IActionResult ForgotPasswordOptions() => Ok(passwordResetService.GetOptions());

    // Step 1: send a 6-digit code to the email / phone. Same reply whether or not an account matches.
    [HttpPost("forgot-password/send-code")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> SendResetCode(SendResetCodeRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(sendResetCodeValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        await passwordResetService.SendCodeAsync(request.Channel, request.Identifier, ct);
        var options = passwordResetService.GetOptions();
        return Ok(new
        {
            message = request.Channel == "Phone"
                ? "If an account uses that phone number, we've sent it a 6-digit code."
                : "If an account uses that email, we've sent it a 6-digit code.",
            expiresInSeconds = options.CodeExpirySeconds,
            resendAfterSeconds = options.ResendCooldownSeconds,
        });
    }

    // Step 2: the right code returns a short-lived reset token for step 3 (reset-password).
    [HttpPost("forgot-password/verify-code")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> VerifyResetCode(VerifyResetCodeRequestDto request, CancellationToken ct)
    {
        if (await ValidateAsync(verifyResetCodeValidator, request, ct) is { } invalid)
        {
            return invalid;
        }

        var result = await passwordResetService.VerifyCodeAsync(request.Channel, request.Identifier, request.Code, ct);
        if (!result.Succeeded)
        {
            return BadRequest(result.Failure == VerifyResetCodeFailure.TooManyAttempts
                ? new { code = "TOO_MANY_ATTEMPTS", message = "Too many wrong codes. Request a new code.", attemptsLeft = (int?)0 }
                : new { code = "INVALID_CODE", message = "That code is wrong or has expired.", attemptsLeft = result.AttemptsLeft });
        }

        return Ok(new { resetToken = result.ResetToken, expiresInSeconds = result.ResetTokenExpiresInSeconds });
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
            return BadRequest(new { message = "This reset session has expired. Request a new code and try again." });
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

    [HttpPost("logout-everywhere")]
    [Authorize]
    public async Task<IActionResult> LogoutEverywhere(CancellationToken ct)
    {
        await refreshTokenService.RevokeAllForUserAsync(tenantContext.CurrentUserId!.Value, ct);
        return Ok(new { message = "You've been signed out on every device." });
    }
}
