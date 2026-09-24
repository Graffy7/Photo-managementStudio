using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public record ImportedSourceCounts(string SourceFolder, int Total, int Selected);

public interface IPhotoRepository
{
    // folderId: null = the whole gallery, 0 = only unfiled photos, >0 = that delivery folder.
    Task<(List<PhotoWithSelection> Items, int TotalCount)> GetPageAsync(
        int galleryId, PhotoFilter filter, string? search, int page, int pageSize, int? folderId, CancellationToken ct = default);

    Task<Photo?> GetByIdAsync(int galleryId, int photoId, CancellationToken ct = default);
    Task<PhotoWithSelection?> GetWithSelectionAsync(int galleryId, int photoId, CancellationToken ct = default);

    // Every selected photo, in photo order — for the CSV export.
    Task<List<PhotoWithSelection>> GetSelectedAsync(int galleryId, CancellationToken ct = default);

    Task<HashSet<string>> GetImportedPathsAsync(int galleryId, CancellationToken ct = default);
    Task<int> GetMaxPhotoNumberAsync(int galleryId, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<Photo> photos, CancellationToken ct = default);

    // Photos that still have preview files on disk, for the post-expiry cleanup.
    Task<List<Photo>> GetWithPreviewsAsync(int galleryId, CancellationToken ct = default);

    // Imported photos whose preview was deleted by cleanup (tracked, so they can be given new ones).
    Task<List<Photo>> GetWithoutPreviewsAsync(int galleryId, CancellationToken ct = default);
    Task<int> CountWithoutPreviewsAsync(int galleryId, CancellationToken ct = default);

    // One row per folder the gallery's photos were imported from. Photos without their own
    // SourceFolder count under the gallery's (fallbackSource).
    Task<List<ImportedSourceCounts>> GetSourceCountsAsync(int galleryId, string? fallbackSource, CancellationToken ct = default);

    // The photos imported from one folder (tracked, so they can be removed).
    Task<List<Photo>> GetBySourceAsync(int galleryId, string sourceFolder, bool includeUnrecorded, CancellationToken ct = default);
    void RemoveRange(IEnumerable<Photo> photos);

    // Newest folder still used by the gallery's photos (null when none recorded).
    Task<string?> GetLatestSourceAsync(int galleryId, CancellationToken ct = default);
    void UpdateRange(IEnumerable<Photo> photos);

    // Selection writes. One row per photo: SetSelectionAsync inserts or updates it, RemoveSelectionAsync
    // deletes it (returns false if there was nothing to remove). Neither saves — the caller's unit of
    // work does.
    Task SetSelectionAsync(int galleryId, int photoId, int selectionType, DateTime now, CancellationToken ct = default);
    Task<bool> RemoveSelectionAsync(int photoId, CancellationToken ct = default);

    // Statement-level update for when an insert lost a race to another request; bypasses the tracker.
    Task UpdateSelectionTypeAsync(int photoId, int selectionType, DateTime now, CancellationToken ct = default);
}
