namespace StudioManagement.Business.PhotoSelection;

public enum SetSelectionFailureReason
{
    PhotoNotFound,
    ProjectLocked,
    LimitExceeded
}

public class SetSelectionResult
{
    public bool Succeeded { get; private init; }
    public SetSelectionFailureReason? FailureReason { get; private init; }
    public PhotoDto? Photo { get; private init; }

    public static SetSelectionResult Success(PhotoDto dto) => new() { Succeeded = true, Photo = dto };
    public static SetSelectionResult Fail(SetSelectionFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public interface IPhotoService
{
    // Each entry's Content stream is read, resized, and discarded — the original bytes are
    // never persisted anywhere. relativePath lets the owner record where the original lives on
    // their own storage (e.g. "Ceremony/IMG_1023.jpg") without the app ever touching that file.
    Task<List<PhotoDto>> ImportPhotosAsync(
        int studioId, int projectId,
        List<(Stream Content, string OriginalFileName, string RelativePath)> files,
        CancellationToken ct = default);

    Task<List<PhotoDto>> GetPhotosAsync(int projectId, int? afterPhotoNumber, int limit, CancellationToken ct = default);

    Task<SetSelectionResult> SetSelectionAsync(int projectId, int photoId, string newSelectionType, CancellationToken ct = default);

    // Reads an arbitrary image file straight off the studio machine's own disk (used by the
    // "Browse" folder picker so an owner can see thumbnails while choosing a Source folder) and
    // returns a small resized JPEG — never the original bytes. Null means "can't preview this":
    // missing, not an image, or too large to safely decode on request.
    Task<byte[]?> GetLocalImagePreviewAsync(string path, CancellationToken ct = default);
}
