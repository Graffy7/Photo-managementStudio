using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPhotoSelectionProjectRepository
{
    Task<PhotoSelectionProject?> GetByIdAsync(int studioId, int projectId, CancellationToken ct = default);
    Task<List<PhotoSelectionProject>> SearchAsync(int studioId, int? customerId, int? eventId, CancellationToken ct = default);

    // Bulk lookup for the "which of these events already have a selection, and what state is it
    // in" list view — one query for any number of events instead of one query per event.
    Task<List<PhotoSelectionProject>> GetByEventIdsAsync(int studioId, List<int> eventIds, CancellationToken ct = default);

    // Unscoped lookup — used only by code paths that already proved access some other way (the
    // owner controller checked studioId, or the public controller checked the access token) and
    // just need the row itself. Never call this directly from a controller.
    Task<PhotoSelectionProject?> GetByIdAsync(int projectId, CancellationToken ct = default);

    // No studioId filter — this is how the public (unauthenticated) customer link resolves its
    // project; the caller must independently check IsActive/expiry before trusting the result.
    Task<PhotoSelectionProject?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);

    Task AddAsync(PhotoSelectionProject project, CancellationToken ct = default);
    void Update(PhotoSelectionProject project);
}
