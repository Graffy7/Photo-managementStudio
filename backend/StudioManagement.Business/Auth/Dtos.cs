namespace StudioManagement.Business.Auth;

public class LoginRequestDto
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public bool RememberMe { get; set; }
}

public class UserProfileDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string UserType { get; set; } = null!;
    public int? StudioId { get; set; }
    public string? StudioName { get; set; }
    public bool IsActive { get; set; }

    // The login *before* this one — set right before LoginAsync overwrites it with "now", so it
    // reads as "when you last logged in" rather than the current moment.
    public DateTime? LastLoginAt { get; set; }
}

public class LoginResponseDto
{
    public string AccessToken { get; set; } = null!;
    public DateTime AccessTokenExpiresAtUtc { get; set; }
    public string RefreshToken { get; set; } = null!;
    public DateTime RefreshTokenExpiresAtUtc { get; set; }
    public UserProfileDto User { get; set; } = null!;
}

public class RefreshRequestDto
{
    public string RefreshToken { get; set; } = null!;
}

public class LogoutRequestDto
{
    public string RefreshToken { get; set; } = null!;
}

public class ForgotPasswordRequestDto
{
    public string Email { get; set; } = null!;
}

// channel: "Email" or "Phone"; identifier: the email address or phone number typed.
public class SendResetCodeRequestDto
{
    public string Channel { get; set; } = null!;
    public string Identifier { get; set; } = null!;
}

public class VerifyResetCodeRequestDto
{
    public string Channel { get; set; } = null!;
    public string Identifier { get; set; } = null!;
    public string Code { get; set; } = null!;
}

public class ResetPasswordRequestDto
{
    public string Token { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
    public string ConfirmPassword { get; set; } = null!;
}

public class ChangePasswordRequestDto
{
    public string CurrentPassword { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
    public string ConfirmPassword { get; set; } = null!;
}
