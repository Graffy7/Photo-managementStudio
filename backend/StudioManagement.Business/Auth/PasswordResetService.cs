using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Email;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Auth;

public class PasswordResetService(
    IUserRepository userRepository,
    IPasswordResetTokenRepository passwordResetTokenRepository,
    IPasswordHasher passwordHasher,
    IEmailSender emailSender,
    IRefreshTokenService refreshTokenService,
    IConfiguration configuration,
    IUnitOfWork unitOfWork,
    ILogger<PasswordResetService> logger) : IPasswordResetService
{
    public async Task RequestResetAsync(string email, CancellationToken ct = default)
    {
        var user = await userRepository.FindByEmailAsync(email, ct);
        if (user is null)
        {
            logger.LogInformation("Password reset requested for an email with no matching account.");
            return;
        }

        var stillActive = await passwordResetTokenRepository.GetActiveByUserIdAsync(user.UserId, ct);
        foreach (var old in stillActive)
        {
            old.UsedAt = DateTime.UtcNow;
            passwordResetTokenRepository.Update(old);
        }

        var expiryMinutes = configuration.GetValue("PasswordReset:ExpiryMinutes", 30);
        var rawToken = TokenHasher.GenerateRawToken();
        await passwordResetTokenRepository.AddAsync(new PasswordResetToken
        {
            UserId = user.UserId,
            TokenHash = TokenHasher.Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes),
            CreatedAt = DateTime.UtcNow
        }, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await emailSender.SendAsync(
            user.Email,
            "Reset your Studio OS password",
            $"Hi {user.FullName},\n\nYour password reset code is: {rawToken}\n\nThis code expires in {expiryMinutes} minutes and can only be used once. If you didn't request this, you can ignore this email.",
            ct);

        logger.LogInformation("Password reset token issued for UserId {UserId}.", user.UserId);
    }

    public async Task<PasswordResetResult> ResetPasswordAsync(string token, string newPassword, CancellationToken ct = default)
    {
        var entry = await passwordResetTokenRepository.FindByTokenHashAsync(TokenHasher.Hash(token), ct);
        if (entry is null || !entry.IsActive)
        {
            logger.LogWarning("Password reset attempted with an invalid or expired token.");
            return PasswordResetResult.Fail(PasswordResetFailureReason.InvalidOrExpiredToken);
        }

        entry.User.PasswordHash = passwordHasher.Hash(newPassword);
        entry.User.UpdatedAt = DateTime.UtcNow;
        userRepository.Update(entry.User);

        entry.UsedAt = DateTime.UtcNow;
        passwordResetTokenRepository.Update(entry);

        await unitOfWork.SaveChangesAsync(ct);
        await refreshTokenService.RevokeAllForUserAsync(entry.UserId, ct);

        logger.LogInformation("Password reset completed for UserId {UserId}.", entry.UserId);
        return PasswordResetResult.Success();
    }
}
