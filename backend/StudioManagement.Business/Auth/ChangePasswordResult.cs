namespace StudioManagement.Business.Auth;

public enum ChangePasswordFailureReason
{
    IncorrectCurrentPassword,
    ConfirmationMismatch
}

public class ChangePasswordResult
{
    public bool Succeeded { get; private init; }
    public ChangePasswordFailureReason? FailureReason { get; private init; }

    public static ChangePasswordResult Success() => new() { Succeeded = true };
    public static ChangePasswordResult Fail(ChangePasswordFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
