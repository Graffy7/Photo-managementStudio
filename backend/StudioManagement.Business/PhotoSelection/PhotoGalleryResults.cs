namespace StudioManagement.Business.PhotoSelection;

public enum LinkFailureReason
{
    GalleryNotFound,
    NoPhotos,
    PreviewsRemoved,
    ImportRunning
}

public class GenerateLinkResult
{
    public bool Succeeded { get; private init; }
    public LinkFailureReason? FailureReason { get; private init; }
    public GenerateLinkResultDto? Link { get; private init; }

    public static GenerateLinkResult Success(GenerateLinkResultDto link) => new() { Succeeded = true, Link = link };
    public static GenerateLinkResult Fail(LinkFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public enum ShareFailureReason
{
    GalleryNotFound,
    NoActiveLink,
    InvalidBaseUrl
}

public class ShareMessageResult
{
    public bool Succeeded { get; private init; }
    public ShareFailureReason? FailureReason { get; private init; }
    public ShareMessageDto? Share { get; private init; }

    public static ShareMessageResult Success(ShareMessageDto share) => new() { Succeeded = true, Share = share };
    public static ShareMessageResult Fail(ShareFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public class GalleryExport
{
    public byte[] Content { get; init; } = [];
    public string FileName { get; init; } = null!;
}

public enum ImportFailureReason
{
    GalleryNotFound,
    FolderNotFound,
    FolderNotAllowed,
    NoImages,
    AlreadyRunning
}

public class ImportStartResult
{
    public bool Succeeded { get; private init; }
    public ImportFailureReason? FailureReason { get; private init; }
    public ImportJobDto? Job { get; private init; }

    public static ImportStartResult Success(ImportJobDto job) => new() { Succeeded = true, Job = job };
    public static ImportStartResult Fail(ImportFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

// The customer link can fail in ways the page words differently: a dead link says nothing more,
// an expired one tells the customer to contact the studio.
public enum GalleryAccessFailure
{
    Invalid,
    Expired
}


public enum SelectionFailureReason
{
    PhotoNotFound,
    Locked,
    InvalidType
}

// A customer-link read: the value, or why the link didn't open.
public class PublicAccess<T> where T : class
{
    public T? Value { get; private init; }
    public GalleryAccessFailure? Failure { get; private init; }

    public static PublicAccess<T> Ok(T value) => new() { Value = value };
    public static PublicAccess<T> Fail(GalleryAccessFailure failure) => new() { Failure = failure };
}

public class SelectionResult
{
    public bool Succeeded { get; private init; }
    public GalleryAccessFailure? AccessFailure { get; private init; }
    public SelectionFailureReason? FailureReason { get; private init; }
    public PublicSelectionResultDto? Selection { get; private init; }

    public static SelectionResult Success(PublicSelectionResultDto selection) => new() { Succeeded = true, Selection = selection };
    public static SelectionResult Fail(SelectionFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
    public static SelectionResult NoAccess(GalleryAccessFailure failure) => new() { Succeeded = false, AccessFailure = failure };
}

public enum SubmitFailureReason
{
    NothingSelected,
    Locked
}

public class SubmitResult
{
    public bool Succeeded { get; private init; }
    public GalleryAccessFailure? AccessFailure { get; private init; }
    public SubmitFailureReason? FailureReason { get; private init; }
    public SubmitResultDto? Result { get; private init; }

    public static SubmitResult Success(SubmitResultDto result) => new() { Succeeded = true, Result = result };
    public static SubmitResult Fail(SubmitFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
    public static SubmitResult NoAccess(GalleryAccessFailure failure) => new() { Succeeded = false, AccessFailure = failure };
}
