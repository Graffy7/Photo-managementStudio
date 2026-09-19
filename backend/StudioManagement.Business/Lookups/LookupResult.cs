namespace StudioManagement.Business.Lookups;

public enum LookupFailureReason
{
    NotFound,
    DuplicateName
}

public enum LookupDeleteResult
{
    Deleted,
    NotFound,
    // Events, enquiries, workers etc. reference lookups with Restrict, so a value that's already
    // in use can't be hard-deleted — the owner can deactivate it instead.
    InUse
}

public class LookupResult
{
    public bool Succeeded { get; private init; }
    public LookupFailureReason? FailureReason { get; private init; }
    public LookupDto? Lookup { get; private init; }

    public static LookupResult Success(LookupDto lookup) => new() { Succeeded = true, Lookup = lookup };
    public static LookupResult Fail(LookupFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
