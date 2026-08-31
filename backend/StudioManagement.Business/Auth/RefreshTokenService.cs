using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Auth;

public class RefreshTokenService(
    IRefreshTokenRepository refreshTokenRepository,
    IConfiguration configuration,
    IUnitOfWork unitOfWork,
    ILogger<RefreshTokenService> logger) : IRefreshTokenService
{
    public async Task<(string RawToken, DateTime ExpiresAtUtc)> IssueAsync(int userId, bool rememberMe, string? createdByIp, CancellationToken ct = default)
    {
        var days = rememberMe
            ? configuration.GetValue("Jwt:RefreshTokenExpiryDaysRemembered", 30)
            : configuration.GetValue("Jwt:RefreshTokenExpiryDaysDefault", 1);

        var rawToken = TokenHasher.GenerateRawToken();
        var now = DateTime.UtcNow;
        var expiresAt = now.AddDays(days);

        await refreshTokenRepository.AddAsync(new RefreshToken
        {
            UserId = userId,
            TokenHash = TokenHasher.Hash(rawToken),
            ExpiresAt = expiresAt,
            CreatedAt = now,
            CreatedByIp = createdByIp
        }, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return (rawToken, expiresAt);
    }

    public async Task<RefreshTokenRotationResult> RotateAsync(string rawToken, string? ip, CancellationToken ct = default)
    {
        var existing = await refreshTokenRepository.FindByTokenHashAsync(TokenHasher.Hash(rawToken), ct);
        if (existing is null)
        {
            return RefreshTokenRotationResult.Fail(RefreshTokenFailureReason.NotFound);
        }

        if (existing.RevokedAt is not null)
        {
            logger.LogWarning("Refresh token reuse detected for UserId {UserId} — possible token theft, revoking all sessions.", existing.UserId);
            await RevokeAllForUserAsync(existing.UserId, ct);
            return RefreshTokenRotationResult.Fail(RefreshTokenFailureReason.Revoked);
        }

        if (existing.ExpiresAt <= DateTime.UtcNow)
        {
            return RefreshTokenRotationResult.Fail(RefreshTokenFailureReason.Expired);
        }

        var remainingLifetime = existing.ExpiresAt - existing.CreatedAt;
        var newRawToken = TokenHasher.GenerateRawToken();
        var newExpiresAt = DateTime.UtcNow.Add(remainingLifetime);

        var replacement = new RefreshToken
        {
            UserId = existing.UserId,
            TokenHash = TokenHasher.Hash(newRawToken),
            ExpiresAt = newExpiresAt,
            CreatedAt = DateTime.UtcNow,
            CreatedByIp = ip
        };
        await refreshTokenRepository.AddAsync(replacement, ct);

        existing.RevokedAt = DateTime.UtcNow;
        refreshTokenRepository.Update(existing);
        await unitOfWork.SaveChangesAsync(ct);

        existing.ReplacedByTokenId = replacement.RefreshTokenId;
        refreshTokenRepository.Update(existing);
        await unitOfWork.SaveChangesAsync(ct);

        return RefreshTokenRotationResult.Success(existing.User, newRawToken, newExpiresAt);
    }

    public async Task RevokeAsync(string rawToken, CancellationToken ct = default)
    {
        var existing = await refreshTokenRepository.FindByTokenHashAsync(TokenHasher.Hash(rawToken), ct);
        if (existing is null || existing.RevokedAt is not null)
        {
            return;
        }

        existing.RevokedAt = DateTime.UtcNow;
        refreshTokenRepository.Update(existing);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task RevokeAllForUserAsync(int userId, CancellationToken ct = default)
    {
        var active = await refreshTokenRepository.GetActiveByUserIdAsync(userId, ct);
        if (active.Count == 0)
        {
            return;
        }

        foreach (var token in active)
        {
            token.RevokedAt = DateTime.UtcNow;
            refreshTokenRepository.Update(token);
        }
        await unitOfWork.SaveChangesAsync(ct);
    }
}
