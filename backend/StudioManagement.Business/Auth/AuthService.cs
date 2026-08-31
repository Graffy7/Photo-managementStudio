using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Auth;

public class AuthService(IUserRepository userRepository, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService) : IAuthService
{
    public async Task<AuthResult> LoginAsync(LoginRequestDto request, CancellationToken ct = default)
    {
        var user = await userRepository.FindByEmailAsync(request.Email, ct);
        if (user is null || !user.IsActive || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return AuthResult.Fail(AuthFailureReason.InvalidCredentials);
        }

        if (user.UserType == UserTypes.StudioOwner)
        {
            if (user.Studio is null || !user.Studio.IsActive)
            {
                return AuthResult.Fail(AuthFailureReason.StudioInactive);
            }
            if (user.Studio.IsBlocked)
            {
                return AuthResult.Fail(AuthFailureReason.StudioBlocked);
            }
        }

        var (token, expiresAtUtc) = jwtTokenService.GenerateToken(user);
        return AuthResult.Success(new LoginResponseDto
        {
            AccessToken = token,
            ExpiresAtUtc = expiresAtUtc,
            User = new UserProfileDto
            {
                UserId = user.UserId,
                FullName = user.FullName,
                Email = user.Email,
                UserType = user.UserType,
                StudioId = user.StudioId
            }
        });
    }

    public async Task<UserProfileDto?> GetProfileAsync(int userId, CancellationToken ct = default)
    {
        var user = await userRepository.GetByIdAsync(userId, ct);
        if (user is null)
        {
            return null;
        }

        return new UserProfileDto
        {
            UserId = user.UserId,
            FullName = user.FullName,
            Email = user.Email,
            UserType = user.UserType,
            StudioId = user.StudioId
        };
    }
}
