using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class RefreshTokenRepository(AppDbContext context) : Repository<RefreshToken>(context), IRefreshTokenRepository
{
    public async Task<bool> TryRevokeAsync(int refreshTokenId, DateTime at, CancellationToken ct = default) =>
        await Set.Where(t => t.RefreshTokenId == refreshTokenId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, at), ct) == 1;

    public async Task SetReplacedByAsync(int refreshTokenId, int replacedById, CancellationToken ct = default) =>
        await Set.Where(t => t.RefreshTokenId == refreshTokenId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ReplacedByTokenId, replacedById), ct);

    public Task<RefreshToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        Set.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public Task<List<RefreshToken>> GetActiveByUserIdAsync(int userId, CancellationToken ct = default) =>
        Set.Where(t => t.UserId == userId && t.RevokedAt == null && t.ExpiresAt > DateTime.UtcNow).ToListAsync(ct);
}
