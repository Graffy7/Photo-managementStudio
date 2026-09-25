using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PasswordResetTokenRepository(AppDbContext context) : Repository<PasswordResetToken>(context), IPasswordResetTokenRepository
{
    public Task<PasswordResetToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        Set.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public Task<List<PasswordResetToken>> GetActiveByUserIdAsync(int userId, CancellationToken ct = default) =>
        Set.Where(t => t.UserId == userId && t.UsedAt == null && t.ExpiresAt > DateTime.UtcNow).ToListAsync(ct);

    public Task<PasswordResetToken?> GetLatestCodeAsync(int userId, CancellationToken ct = default) =>
        Set.Where(t => t.UserId == userId && t.Channel != null)
            .OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.PasswordResetTokenId)
            .FirstOrDefaultAsync(ct);

    public Task<int> CountCodesSinceAsync(int userId, DateTime sinceUtc, CancellationToken ct = default) =>
        Set.CountAsync(t => t.UserId == userId && t.Channel != null && t.CreatedAt >= sinceUtc, ct);

    public async Task<int> AddFailedAttemptAsync(int tokenId, CancellationToken ct = default)
    {
        await Set.Where(t => t.PasswordResetTokenId == tokenId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.FailedAttempts, t => t.FailedAttempts + 1), ct);
        return await Set.Where(t => t.PasswordResetTokenId == tokenId).Select(t => t.FailedAttempts).FirstAsync(ct);
    }

    public async Task<bool> TryMarkUsedAsync(int tokenId, CancellationToken ct = default) =>
        await Set.Where(t => t.PasswordResetTokenId == tokenId && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow), ct) == 1;
}
