using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPasswordResetTokenRepository : IRepository<PasswordResetToken>
{
    Task<PasswordResetToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task<List<PasswordResetToken>> GetActiveByUserIdAsync(int userId, CancellationToken ct = default);

    // --- 6-digit codes (Channel set) ---
    Task<PasswordResetToken?> GetLatestCodeAsync(int userId, CancellationToken ct = default);
    Task<int> CountCodesSinceAsync(int userId, DateTime sinceUtc, CancellationToken ct = default);
    // Atomic, so two parallel guesses can't both slip under the attempt limit. Returns the new count.
    Task<int> AddFailedAttemptAsync(int tokenId, CancellationToken ct = default);
    // Marks an entry used only if it still wasn't; false = someone else used it first.
    Task<bool> TryMarkUsedAsync(int tokenId, CancellationToken ct = default);
}
