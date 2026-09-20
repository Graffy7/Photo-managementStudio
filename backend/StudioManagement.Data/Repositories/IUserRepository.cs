using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IUserRepository : IRepository<User>
{
    Task<User?> FindByEmailAsync(string email, CancellationToken ct = default);
    Task<List<User>> GetByIdsAsync(IEnumerable<int> ids, CancellationToken ct = default);
    Task<User?> GetByIdWithStudioAsync(int userId, CancellationToken ct = default);

    // The studio owner's login account, for the super admin's studio detail screen.
    Task<User?> GetStudioOwnerAsync(int studioId, CancellationToken ct = default);
    Task<List<User>> GetStudioOwnersAsync(IEnumerable<int> studioIds, CancellationToken ct = default);
}
