using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    Task<RefreshToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task<List<RefreshToken>> GetActiveByUserIdAsync(int userId, CancellationToken ct = default);
    // Revokes the token only if it still isn't revoked - atomic, so of two refreshes racing with the
    // same token exactly one wins. False = someone else already used it.
    Task<bool> TryRevokeAsync(int refreshTokenId, DateTime at, CancellationToken ct = default);
    Task SetReplacedByAsync(int refreshTokenId, int replacedById, CancellationToken ct = default);
}
