using Microsoft.Extensions.Logging;
using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Auth;

public class AuthService(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IRefreshTokenService refreshTokenService,
    IUnitOfWork unitOfWork,
    ILogger<AuthService> logger) : IAuthService
{
    public async Task<AuthResult> LoginAsync(LoginRequestDto request, string? ip, CancellationToken ct = default)
    {
        var user = await userRepository.FindByEmailAsync(request.Email, ct);
        if (user is null || !user.IsActive || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            logger.LogWarning("Failed login attempt for {Email}.", request.Email);
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

        var response = await BuildLoginResponseAsync(user, request.RememberMe, ip, ct);
        logger.LogInformation("UserId {UserId} logged in.", user.UserId);
        return AuthResult.Success(response);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, string? ip, CancellationToken ct = default)
    {
        var rotation = await refreshTokenService.RotateAsync(refreshToken, ip, ct);
        if (!rotation.Succeeded)
        {
            var reason = rotation.FailureReason switch
            {
                RefreshTokenFailureReason.Expired => AuthFailureReason.RefreshTokenExpired,
                RefreshTokenFailureReason.Revoked => AuthFailureReason.RefreshTokenRevoked,
                _ => AuthFailureReason.RefreshTokenInvalid
            };
            return AuthResult.Fail(reason);
        }

        var user = rotation.User!;
        var (accessToken, accessTokenExpiresAtUtc) = jwtTokenService.GenerateToken(user);

        return AuthResult.Success(new LoginResponseDto
        {
            AccessToken = accessToken,
            AccessTokenExpiresAtUtc = accessTokenExpiresAtUtc,
            RefreshToken = rotation.NewRawToken!,
            RefreshTokenExpiresAtUtc = rotation.NewExpiresAtUtc!.Value,
            User = ToProfileDto(user)
        });
    }

    public Task LogoutAsync(string refreshToken, CancellationToken ct = default) =>
        refreshTokenService.RevokeAsync(refreshToken, ct);

    public async Task<ChangePasswordResult> ChangePasswordAsync(int userId, ChangePasswordRequestDto request, CancellationToken ct = default)
    {
        if (request.NewPassword != request.ConfirmPassword)
        {
            return ChangePasswordResult.Fail(ChangePasswordFailureReason.ConfirmationMismatch);
        }

        var user = await userRepository.GetByIdAsync(userId, ct);
        if (user is null || !passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            logger.LogWarning("Failed change-password attempt for UserId {UserId}: incorrect current password.", userId);
            return ChangePasswordResult.Fail(ChangePasswordFailureReason.IncorrectCurrentPassword);
        }

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        userRepository.Update(user);
        await unitOfWork.SaveChangesAsync(ct);

        await refreshTokenService.RevokeAllForUserAsync(userId, ct);

        logger.LogInformation("UserId {UserId} changed their password.", userId);
        return ChangePasswordResult.Success();
    }

    public async Task<UserProfileDto?> GetProfileAsync(int userId, CancellationToken ct = default)
    {
        var user = await userRepository.GetByIdAsync(userId, ct);
        return user is null ? null : ToProfileDto(user);
    }

    private async Task<LoginResponseDto> BuildLoginResponseAsync(Data.Entities.User user, bool rememberMe, string? ip, CancellationToken ct)
    {
        var (accessToken, accessTokenExpiresAtUtc) = jwtTokenService.GenerateToken(user);
        var (refreshToken, refreshTokenExpiresAtUtc) = await refreshTokenService.IssueAsync(user.UserId, rememberMe, ip, ct);

        return new LoginResponseDto
        {
            AccessToken = accessToken,
            AccessTokenExpiresAtUtc = accessTokenExpiresAtUtc,
            RefreshToken = refreshToken,
            RefreshTokenExpiresAtUtc = refreshTokenExpiresAtUtc,
            User = ToProfileDto(user)
        };
    }

    private static UserProfileDto ToProfileDto(Data.Entities.User user) => new()
    {
        UserId = user.UserId,
        FullName = user.FullName,
        Email = user.Email,
        UserType = user.UserType,
        StudioId = user.StudioId
    };
}
