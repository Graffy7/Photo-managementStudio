namespace StudioManagement.Business.Studios;

public enum StudioCreationFailureReason
{
    EmailAlreadyExists,
    PlanNotFound
}

public class StudioCreationResult
{
    public bool Succeeded { get; private init; }
    public StudioCreationFailureReason? FailureReason { get; private init; }
    public StudioDto? Studio { get; private init; }

    public static StudioCreationResult Success(StudioDto studio) => new() { Succeeded = true, Studio = studio };
    public static StudioCreationResult Fail(StudioCreationFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public enum StudioUpdateFailureReason
{
    NotFound,
    EmailAlreadyExists
}

public class StudioUpdateResult
{
    public bool Succeeded { get; private init; }
    public StudioUpdateFailureReason? FailureReason { get; private init; }
    public StudioDto? Studio { get; private init; }

    public static StudioUpdateResult Success(StudioDto studio) => new() { Succeeded = true, Studio = studio };
    public static StudioUpdateResult Fail(StudioUpdateFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public enum PasswordResetFailureReason
{
    StudioNotFound,
    OwnerNotFound
}

public class PasswordResetResult
{
    public bool Succeeded { get; private init; }
    public PasswordResetFailureReason? FailureReason { get; private init; }

    // Echoed back so the super admin can copy the exact login they just set and pass it to the owner.
    public string? LoginEmail { get; private init; }

    public static PasswordResetResult Success(string loginEmail) => new() { Succeeded = true, LoginEmail = loginEmail };
    public static PasswordResetResult Fail(PasswordResetFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
