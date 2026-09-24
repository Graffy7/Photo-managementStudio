using StudioManagement.Business.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.PhotoSelection;

// The studio owner's side of photo selection.
public interface IPhotoGalleryService
{
    Task<PagedResult<CompletedEventGalleryDto>> GetCompletedEventsAsync(int studioId, string? search, int page, int pageSize, CancellationToken ct = default);

    // Opens the event's gallery, creating an empty one the first time. Null = no such event.
    Task<OwnerGalleryDto?> GetOrCreateForEventAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<OwnerGalleryDto?> GetAsync(int studioId, int galleryId, CancellationToken ct = default);

    Task<GenerateLinkResult> GenerateLinkAsync(int studioId, int galleryId, int expiresInDays, CancellationToken ct = default);
    Task<bool> RevokeLinkAsync(int studioId, int galleryId, CancellationToken ct = default);
    Task<bool> SetLockedAsync(int studioId, int galleryId, bool locked, CancellationToken ct = default);

    Task<OwnerPhotosPageDto?> GetPhotosAsync(int studioId, int galleryId, PhotoFilter filter, string? search, int page, int pageSize, int? folderId, CancellationToken ct = default);
    Task<GalleryExport?> ExportSelectionAsync(int studioId, int galleryId, CancellationToken ct = default);

    // The message (and wa.me link) the owner sends to the customer. baseUrl is the site the owner is
    // using (e.g. https://studio.example.com) — the link the customer opens is baseUrl + /photo-selection/{token}.
    Task<ShareMessageResult> GetShareMessageAsync(int studioId, int galleryId, string baseUrl, bool reminder, CancellationToken ct = default);
}
