namespace StudioManagement.Business.Auth;

public record PasswordResetOptions(bool PhoneAvailable, int CodeExpirySeconds, int ResendCooldownSeconds);

public enum VerifyResetCodeFailure
{
    InvalidOrExpired,
    TooManyAttempts
}

public class VerifyResetCodeResult
{
    public bool Succeeded { get; private init; }
    public string? ResetToken { get; private init; }
    public int ResetTokenExpiresInSeconds { get; private init; }
    public VerifyResetCodeFailure? Failure { get; private init; }
    public int? AttemptsLeft { get; private init; }

    public static VerifyResetCodeResult Success(string resetToken, int expiresInSeconds) =>
        new() { Succeeded = true, ResetToken = resetToken, ResetTokenExpiresInSeconds = expiresInSeconds };

    public static VerifyResetCodeResult Fail(VerifyResetCodeFailure failure, int? attemptsLeft = null) =>
        new() { Failure = failure, AttemptsLeft = attemptsLeft };
}
