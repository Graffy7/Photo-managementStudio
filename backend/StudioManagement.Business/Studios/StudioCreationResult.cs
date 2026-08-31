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
