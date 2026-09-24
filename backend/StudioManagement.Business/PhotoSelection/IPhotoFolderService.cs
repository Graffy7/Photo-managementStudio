namespace StudioManagement.Business.PhotoSelection;

public enum FolderFailureReason
{
    GalleryNotFound,
    FolderNotFound,
    DuplicateName
}

public class FolderResult
{
    public bool Succeeded { get; private init; }
    public FolderFailureReason? FailureReason { get; private init; }
    public PhotoFolderDto? Folder { get; private init; }

    public static FolderResult Success(PhotoFolderDto? folder = null) => new() { Succeeded = true, Folder = folder };
    public static FolderResult Fail(FolderFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public interface IPhotoFolderService
{
    Task<List<PhotoFolderDto>?> GetAsync(int studioId, int galleryId, CancellationToken ct = default);
    Task<FolderResult> CreateAsync(int studioId, int galleryId, SaveFolderRequestDto request, CancellationToken ct = default);
    Task<FolderResult> RenameAsync(int studioId, int galleryId, int folderId, SaveFolderRequestDto request, CancellationToken ct = default);
    Task<FolderResult> SetDeliveredAsync(int studioId, int galleryId, int folderId, bool isDelivered, CancellationToken ct = default);

    // Removes the folder only - its photos stay in the gallery, unfiled.
    Task<FolderResult> DeleteAsync(int studioId, int galleryId, int folderId, CancellationToken ct = default);
}
