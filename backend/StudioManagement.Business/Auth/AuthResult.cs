namespace StudioManagement.Business.Auth;

public enum AuthFailureReason
{
    InvalidCredentials,
    StudioInactive,
    StudioBlocked,
    RefreshTokenInvalid,
    RefreshTokenExpired,
    RefreshTokenRevoked
}

public class AuthResult
{
    public bool Succeeded { get; private init; }
    public AuthFailureReason? FailureReason { get; private init; }
    public LoginResponseDto? Response { get; private init; }

    public static AuthResult Success(LoginResponseDto response) => new() { Succeeded = true, Response = response };
    public static AuthResult Fail(AuthFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
