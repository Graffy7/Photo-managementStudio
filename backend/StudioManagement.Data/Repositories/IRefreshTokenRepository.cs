using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    Task<RefreshToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task<List<RefreshToken>> GetActiveByUserIdAsync(int userId, CancellationToken ct = default);
}
