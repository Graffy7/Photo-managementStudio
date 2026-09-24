using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

// Photo counts for one folder of a gallery. FolderId is null for the photos that aren't filed.
public record FolderPhotoCounts(int? FolderId, int Total, int Selected);

public interface IPhotoFolderRepository
{
    Task<List<PhotoFolder>> GetByGalleryAsync(int galleryId, CancellationToken ct = default);
    Task<PhotoFolder?> GetByIdAsync(int studioId, int folderId, CancellationToken ct = default);
    Task<PhotoFolder?> GetByNameAsync(int galleryId, string name, CancellationToken ct = default);
    Task<List<FolderPhotoCounts>> GetCountsAsync(int galleryId, CancellationToken ct = default);
    Task<int> GetMaxSortOrderAsync(int galleryId, CancellationToken ct = default);
    Task AddAsync(PhotoFolder folder, CancellationToken ct = default);
    void Update(PhotoFolder folder);
    void Remove(PhotoFolder folder);

    // Clears the folder from its photos, leaving the photos themselves untouched.
    Task<int> UnfilePhotosAsync(int folderId, CancellationToken ct = default);

    // Files every photo of the gallery whose SourceRelativePath sits in a subfolder, creating the
    // folders as needed. Used to bring galleries imported before folders existed up to date.
    Task<int> BackfillFromPathsAsync(int studioId, int galleryId, CancellationToken ct = default);
}
