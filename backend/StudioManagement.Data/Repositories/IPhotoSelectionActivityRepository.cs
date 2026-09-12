using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPhotoSelectionActivityRepository
{
    Task AddAsync(PhotoSelectionActivity activity, CancellationToken ct = default);
    Task<List<PhotoSelectionActivity>> SearchAsync(int projectId, CancellationToken ct = default);
}
