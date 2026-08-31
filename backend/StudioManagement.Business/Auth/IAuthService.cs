namespace StudioManagement.Business.Auth;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequestDto request, CancellationToken ct = default);
    Task<UserProfileDto?> GetProfileAsync(int userId, CancellationToken ct = default);
}
