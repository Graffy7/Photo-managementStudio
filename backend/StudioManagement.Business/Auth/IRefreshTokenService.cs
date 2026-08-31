namespace StudioManagement.Business.Auth;

public interface IRefreshTokenService
{
    Task<(string RawToken, DateTime ExpiresAtUtc)> IssueAsync(int userId, bool rememberMe, string? createdByIp, CancellationToken ct = default);
    Task<RefreshTokenRotationResult> RotateAsync(string rawToken, string? ip, CancellationToken ct = default);
    Task RevokeAsync(string rawToken, CancellationToken ct = default);
    Task RevokeAllForUserAsync(int userId, CancellationToken ct = default);
}
