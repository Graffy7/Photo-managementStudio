namespace StudioManagement.Business.Auth;

public interface IPasswordResetService
{
    PasswordResetOptions GetOptions();
    Task RequestResetAsync(string email, CancellationToken ct = default);
    // channel: PasswordResetChannels.Email / Phone; identifier: the email or phone number typed.
    Task SendCodeAsync(string channel, string identifier, CancellationToken ct = default);
    Task<VerifyResetCodeResult> VerifyCodeAsync(string channel, string identifier, string code, CancellationToken ct = default);
    Task<PasswordResetResult> ResetPasswordAsync(string token, string newPassword, CancellationToken ct = default);
}
