namespace StudioManagement.Business.Auth;

public enum PasswordResetFailureReason
{
    InvalidOrExpiredToken
}

public class PasswordResetResult
{
    public bool Succeeded { get; private init; }
    public PasswordResetFailureReason? FailureReason { get; private init; }

    public static PasswordResetResult Success() => new() { Succeeded = true };
    public static PasswordResetResult Fail(PasswordResetFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
