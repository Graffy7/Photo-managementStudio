using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPhotoGalleryRepository
{
    Task<PhotoGallery?> GetByIdAsync(int studioId, int galleryId, CancellationToken ct = default);
    Task<PhotoGallery?> GetByEventIdAsync(int studioId, int eventId, CancellationToken ct = default);

    // Bulk lookups for the owner's "completed events and their gallery state" list — one query each.
    // Completed events, newest first, with customer and type — the rows of the owner list.
    Task<(List<Event> Items, int TotalCount)> GetCompletedEventsAsync(int studioId, string? search, int page, int pageSize, CancellationToken ct = default);

    Task<List<PhotoGallery>> GetByEventIdsAsync(int studioId, List<int> eventIds, CancellationToken ct = default);
    Task<Dictionary<int, GallerySelectionCounts>> GetCountsForGalleriesAsync(List<int> galleryIds, CancellationToken ct = default);

    // No studioId filter — how the public (unauthenticated) customer link resolves its gallery. The
    // caller must independently check IsLinkActive/expiry before trusting the result.
    Task<PhotoGallery?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);

    // Unscoped by studio, for code paths that already proved access (token resolved, or the owner
    // controller checked the studio) and just need the row itself. Never call from a controller.
    Task<PhotoGallery?> GetByIdUnscopedAsync(int galleryId, CancellationToken ct = default);

    // Records that this gallery's photos have been sorted into folders, so it never happens twice.
    Task MarkFoldersBackfilledAsync(int galleryId, DateTime when, CancellationToken ct = default);

    Task<GallerySelectionCounts> GetCountsAsync(int galleryId, CancellationToken ct = default);
    Task<List<PhotoGallery>> GetExpiredForCleanupAsync(DateTime expiredBefore, CancellationToken ct = default);

    Task AddAsync(PhotoGallery gallery, CancellationToken ct = default);

    // Single-statement updates (no change tracking): the gallery row is read with several related
    // entities included, so re-attaching and saving it would rewrite those too. These touch only
    // the columns named.
    Task SetSourceFolderAsync(int galleryId, string sourceFolder, DateTime now, CancellationToken ct = default);
    Task SetLinkAsync(int galleryId, string tokenHash, string tokenProtected, DateTime? expiresAt, DateTime now, CancellationToken ct = default);
    Task RevokeLinkAsync(int galleryId, DateTime now, CancellationToken ct = default);
    Task SetStatusAsync(int galleryId, string status, DateTime now, CancellationToken ct = default);
    Task MarkFirstOpenedAsync(int galleryId, DateTime now, CancellationToken ct = default);
    Task MarkSelectionChangedAsync(int galleryId, DateTime now, CancellationToken ct = default);
    // Atomic "first submit, or first submit since the customer edited": false = nothing changed, so a
    // double-tap or retried request cannot notify the owner twice.
    Task<bool> MarkSubmittedAsync(int galleryId, DateTime now, CancellationToken ct = default);
    Task MarkPreviewsPurgedAsync(int galleryId, DateTime now, CancellationToken ct = default);

    // Records a finished create/sync: SelectionCreatedAt is set the first time only.
    Task MarkSelectionSyncedAsync(int galleryId, DateTime syncedAt, CancellationToken ct = default);

    Task<PhotoImportJob?> GetJobAsync(int galleryId, int jobId, CancellationToken ct = default);
    Task<PhotoImportJob?> GetJobByIdAsync(int jobId, CancellationToken ct = default);
    Task<PhotoImportJob?> GetLatestJobAsync(int galleryId, CancellationToken ct = default);
    Task<List<PhotoImportJob>> GetUnfinishedJobsAsync(CancellationToken ct = default);
    Task AddJobAsync(PhotoImportJob job, CancellationToken ct = default);
    void UpdateJob(PhotoImportJob job);
}
