using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPhotoRepository
{
    Task<Photo?> GetByIdAsync(int projectId, int photoId, CancellationToken ct = default);

    // Cursor pagination by PhotoNumber (unique per project) — pass the last PhotoNumber seen,
    // or null for the first page. Ordered ascending so "load next 50" is a stable, cheap query.
    Task<List<Photo>> SearchAsync(int projectId, int? afterPhotoNumber, int limit, CancellationToken ct = default);

    Task<(int Total, int Normal, int Big)> GetCountsAsync(int projectId, CancellationToken ct = default);
    Task<List<Photo>> GetSelectedAsync(int projectId, CancellationToken ct = default);
    Task<int> GetMaxPhotoNumberAsync(int projectId, CancellationToken ct = default);

    Task AddRangeAsync(IEnumerable<Photo> photos, CancellationToken ct = default);
    void Update(Photo photo);
}
