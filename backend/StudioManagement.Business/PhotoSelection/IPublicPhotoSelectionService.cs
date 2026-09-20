using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.PhotoSelection;

// The customer's side: everything is addressed by the private link token, never by an internal id
// the customer could guess. A token that is unknown, revoked or expired opens nothing.
public interface IPublicPhotoSelectionService
{
    Task<PublicAccess<PublicGalleryDto>> GetGalleryAsync(string token, CancellationToken ct = default);
    Task<PublicAccess<PublicPhotosPageDto>> GetPhotosAsync(string token, PhotoFilter filter, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<PublicAccess<GalleryCountsDto>> GetSummaryAsync(string token, CancellationToken ct = default);

    Task<SelectionResult> SetSelectionAsync(string token, int photoId, int selectionType, CancellationToken ct = default);
    Task<SelectionResult> RemoveSelectionAsync(string token, int photoId, CancellationToken ct = default);
    Task<SubmitResult> SubmitAsync(string token, CancellationToken ct = default);
}
