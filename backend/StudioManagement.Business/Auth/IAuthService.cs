namespace StudioManagement.Business.Auth;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequestDto request, string? ip, CancellationToken ct = default);
    Task<AuthResult> RefreshAsync(string refreshToken, string? ip, CancellationToken ct = default);
    Task LogoutAsync(string refreshToken, CancellationToken ct = default);
    Task<ChangePasswordResult> ChangePasswordAsync(int userId, ChangePasswordRequestDto request, CancellationToken ct = default);
    Task<UserProfileDto?> GetProfileAsync(int userId, CancellationToken ct = default);
}
