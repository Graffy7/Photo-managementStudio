using System.Globalization;
using Microsoft.Extensions.Caching.Memory;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Auth;

// Access tokens are self-contained (JWT) and normally stay valid until they expire (15 min). When every
// session of a user must end right away - "Sign out everywhere", a password change or reset, a stolen
// refresh token - this records the moment, and every request carrying a token issued before it is
// refused (the app then asks the person to sign in again). Signing out one device doesn't use this, so
// a phone and a PC signed in together are unaffected.
//
// Stored per user in the studio's existing key-value settings (no schema change), so it survives
// restarts and is shared by every API server; cached briefly because it's read on every request.
public interface ISessionRevocationService
{
    Task RevokeAllAsync(int userId, CancellationToken ct = default);
    Task<bool> IsIssuedBeforeRevocationAsync(int userId, DateTime issuedAtUtc, CancellationToken ct = default);
}

public class SessionRevocationService(IUserRepository users, IStudioSettingRepository settings, IMemoryCache cache) : ISessionRevocationService
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    private static string SettingKey(int userId) => $"Auth.SessionsValidAfter.{userId}";
    private static string CacheKey(int userId) => $"sessions-valid-after:{userId}";

    public async Task RevokeAllAsync(int userId, CancellationToken ct = default)
    {
        // Tokens issued before this instant stop working (compared to the millisecond).
        var validAfter = DateTime.UtcNow;
        var user = await users.GetByIdAsync(userId, ct);
        if (user?.StudioId is { } studioId)
        {
            await settings.UpsertManyAsync(studioId, new Dictionary<string, string?>
            {
                [SettingKey(userId)] = validAfter.ToString("O", CultureInfo.InvariantCulture)
            }, ct);
        }
        // Platform admins have no studio settings: kept in memory (their refresh tokens are revoked anyway).
        cache.Set(CacheKey(userId), (DateTime?)validAfter, user?.StudioId is null ? TimeSpan.FromHours(1) : CacheFor);
    }

    public async Task<bool> IsIssuedBeforeRevocationAsync(int userId, DateTime issuedAtUtc, CancellationToken ct = default)
    {
        if (!cache.TryGetValue(CacheKey(userId), out DateTime? validAfter))
        {
            validAfter = await LoadAsync(userId, ct);
            cache.Set(CacheKey(userId), validAfter, CacheFor);
        }
        return validAfter is not null && issuedAtUtc < validAfter.Value;
    }

    private async Task<DateTime?> LoadAsync(int userId, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(userId, ct);
        if (user?.StudioId is not { } studioId)
        {
            return null;
        }
        var value = (await settings.GetAllForStudioAsync(studioId, ct)).FirstOrDefault(s => s.SettingKey == SettingKey(userId))?.SettingValue;
        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed) ? parsed.ToUniversalTime() : null;
    }
}
