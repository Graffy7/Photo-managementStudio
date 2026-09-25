using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Email;
using StudioManagement.Business.Sms;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Auth;

// Forgot password: a 6-digit code goes to the account's email or phone; the right code swaps for a
// short-lived reset token, which sets the new password (ResetPasswordAsync). Replies never say
// whether an account exists.
public class PasswordResetService(
    IUserRepository userRepository,
    IPasswordResetTokenRepository passwordResetTokenRepository,
    IPasswordHasher passwordHasher,
    IEmailSender emailSender,
    ISmsSender smsSender,
    IRefreshTokenService refreshTokenService,
    IConfiguration configuration,
    IUnitOfWork unitOfWork,
    ILogger<PasswordResetService> logger) : IPasswordResetService
{
    private int CodeExpiryMinutes => configuration.GetValue("PasswordReset:CodeExpiryMinutes", 5);
    private int ResendCooldownSeconds => configuration.GetValue("PasswordReset:ResendCooldownSeconds", 60);
    private int MaxAttempts => configuration.GetValue("PasswordReset:MaxAttempts", 5);
    private int MaxCodesPerHour => configuration.GetValue("PasswordReset:MaxCodesPerHour", 5);
    private int ResetTokenMinutes => configuration.GetValue("PasswordReset:ResetTokenMinutes", 10);

    public PasswordResetOptions GetOptions() => new(
        PhoneAvailable: !string.IsNullOrWhiteSpace(configuration["Sms:Provider"]),
        CodeExpirySeconds: CodeExpiryMinutes * 60,
        ResendCooldownSeconds: ResendCooldownSeconds);

    // The old endpoint (email only) now sends the same 6-digit code.
    public Task RequestResetAsync(string email, CancellationToken ct = default) =>
        SendCodeAsync(PasswordResetChannels.Email, email, ct);

    public async Task SendCodeAsync(string channel, string identifier, CancellationToken ct = default)
    {
        if (channel == PasswordResetChannels.Phone && !GetOptions().PhoneAvailable)
        {
            logger.LogWarning("Phone reset code requested but no SMS provider is configured.");
            return;
        }

        var user = await FindAccountAsync(channel, identifier, ct);
        if (user is null)
        {
            logger.LogInformation("Password reset code requested ({Channel}) with no single matching account.", channel);
            return;
        }

        var now = DateTime.UtcNow;
        var latest = await passwordResetTokenRepository.GetLatestCodeAsync(user.UserId, ct);
        if (latest is not null && latest.CreatedAt > now.AddSeconds(-ResendCooldownSeconds))
        {
            logger.LogInformation("Password reset code for UserId {UserId} not resent: still in the cooldown.", user.UserId);
            return;
        }
        if (await passwordResetTokenRepository.CountCodesSinceAsync(user.UserId, now.AddHours(-1), ct) >= MaxCodesPerHour)
        {
            logger.LogWarning("Password reset code for UserId {UserId} not sent: hourly limit reached.", user.UserId);
            return;
        }

        // A new code replaces every earlier code and unused reset token.
        foreach (var old in await passwordResetTokenRepository.GetActiveByUserIdAsync(user.UserId, ct))
        {
            old.UsedAt = now;
            passwordResetTokenRepository.Update(old);
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        await passwordResetTokenRepository.AddAsync(new PasswordResetToken
        {
            UserId = user.UserId,
            Channel = channel,
            TokenHash = HashCode(user.UserId, code),
            ExpiresAt = now.AddMinutes(CodeExpiryMinutes),
            CreatedAt = now
        }, ct);
        await unitOfWork.SaveChangesAsync(ct);

        if (channel == PasswordResetChannels.Email)
        {
            await emailSender.SendAsync(
                user.Email,
                $"{code} is your Studio OS password reset code",
                $"Hi {user.FullName},\n\nYour Studio OS password reset code is: {code}\n\n" +
                $"It expires in {CodeExpiryMinutes} minutes and can be used once. Never share this code with anyone - " +
                "Studio OS staff will never ask for it.\n\nIf you didn't ask to reset your password, you can ignore this email; your password stays the same.",
                ct);
        }
        else
        {
            await smsSender.SendAsync(
                PhoneFor(user)!,
                $"{code} is your Studio OS password reset code. It expires in {CodeExpiryMinutes} minutes. Do not share it with anyone.",
                ct);
        }

        logger.LogInformation("Password reset code sent by {Channel} for UserId {UserId}.", channel, user.UserId);
    }

    public async Task<VerifyResetCodeResult> VerifyCodeAsync(string channel, string identifier, string code, CancellationToken ct = default)
    {
        var user = await FindAccountAsync(channel, identifier, ct);
        var entry = user is null ? null : await passwordResetTokenRepository.GetLatestCodeAsync(user.UserId, ct);
        if (user is null || entry is null || !entry.IsActive || entry.Channel != channel)
        {
            return VerifyResetCodeResult.Fail(VerifyResetCodeFailure.InvalidOrExpired);
        }

        var expected = Convert.FromHexString(entry.TokenHash);
        var given = Convert.FromHexString(HashCode(user.UserId, code.Trim()));
        if (!CryptographicOperations.FixedTimeEquals(expected, given))
        {
            var attempts = await passwordResetTokenRepository.AddFailedAttemptAsync(entry.PasswordResetTokenId, ct);
            if (attempts >= MaxAttempts)
            {
                await passwordResetTokenRepository.TryMarkUsedAsync(entry.PasswordResetTokenId, ct);
                logger.LogWarning("Password reset code for UserId {UserId} locked after {Attempts} wrong attempts.", user.UserId, attempts);
                return VerifyResetCodeResult.Fail(VerifyResetCodeFailure.TooManyAttempts);
            }
            return VerifyResetCodeResult.Fail(VerifyResetCodeFailure.InvalidOrExpired, MaxAttempts - attempts);
        }

        // Single use: of two parallel correct submissions only one gets a reset token.
        if (!await passwordResetTokenRepository.TryMarkUsedAsync(entry.PasswordResetTokenId, ct))
        {
            return VerifyResetCodeResult.Fail(VerifyResetCodeFailure.InvalidOrExpired);
        }

        var rawToken = TokenHasher.GenerateRawToken();
        await passwordResetTokenRepository.AddAsync(new PasswordResetToken
        {
            UserId = user.UserId,
            TokenHash = TokenHasher.Hash(rawToken),
            ExpiresAt = DateTime.UtcNow.AddMinutes(ResetTokenMinutes),
            CreatedAt = DateTime.UtcNow
        }, ct);
        await unitOfWork.SaveChangesAsync(ct);

        logger.LogInformation("Password reset code verified for UserId {UserId}.", user.UserId);
        return VerifyResetCodeResult.Success(rawToken, ResetTokenMinutes * 60);
    }

    public async Task<PasswordResetResult> ResetPasswordAsync(string token, string newPassword, CancellationToken ct = default)
    {
        var entry = await passwordResetTokenRepository.FindByTokenHashAsync(TokenHasher.Hash(token), ct);
        // Only a reset token works here - never a 6-digit code.
        if (entry is null || !entry.IsActive || entry.Channel is not null || !entry.User.IsActive)
        {
            logger.LogWarning("Password reset attempted with an invalid or expired token.");
            return PasswordResetResult.Fail(PasswordResetFailureReason.InvalidOrExpiredToken);
        }
        if (!await passwordResetTokenRepository.TryMarkUsedAsync(entry.PasswordResetTokenId, ct))
        {
            return PasswordResetResult.Fail(PasswordResetFailureReason.InvalidOrExpiredToken);
        }

        entry.User.PasswordHash = passwordHasher.Hash(newPassword);
        entry.User.UpdatedAt = DateTime.UtcNow;
        userRepository.Update(entry.User);

        await unitOfWork.SaveChangesAsync(ct);
        // Every device signed in with the old password is signed out.
        await refreshTokenService.RevokeAllForUserAsync(entry.UserId, ct);

        logger.LogInformation("Password reset completed for UserId {UserId}.", entry.UserId);
        return PasswordResetResult.Success();
    }

    // The one active login the email or phone belongs to, or null (unknown, inactive or ambiguous).
    private async Task<User?> FindAccountAsync(string channel, string identifier, CancellationToken ct)
    {
        if (channel == PasswordResetChannels.Email)
        {
            var user = await userRepository.FindByEmailAsync(identifier.Trim(), ct);
            return user is { IsActive: true } ? user : null;
        }

        var digits = LastTenDigits(identifier);
        if (digits is null)
        {
            return null;
        }

        var matches = new List<User>();
        // The platform admin has no studio; their phone comes from configuration.
        if (LastTenDigits(configuration["PasswordReset:SuperAdminPhone"]) == digits
            && configuration["Bootstrap:SuperAdminEmail"] is { Length: > 0 } adminEmail
            && await userRepository.FindByEmailAsync(adminEmail, ct) is { IsActive: true, UserType: UserTypes.SuperAdmin } admin)
        {
            matches.Add(admin);
        }
        matches.AddRange(await userRepository.FindActiveOwnersByStudioPhoneAsync(digits, ct));

        // A number shared by two accounts can't say whose password to reset - use email instead.
        return matches.Count == 1 ? matches[0] : null;
    }

    private string? PhoneFor(User user) =>
        user.UserType == UserTypes.SuperAdmin ? configuration["PasswordReset:SuperAdminPhone"] : user.Studio?.PhoneNumber;

    private static string? LastTenDigits(string? phone)
    {
        var digits = new string((phone ?? "").Where(char.IsDigit).ToArray());
        return digits.Length >= 10 ? digits[^10..] : null;
    }

    // Keyed hash: a leaked table can't be brute-forced back to the codes without the server key.
    private string HashCode(int userId, string code)
    {
        var key = configuration["PasswordReset:CodeHashKey"] ?? configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{userId}:{code}")));
    }
}
