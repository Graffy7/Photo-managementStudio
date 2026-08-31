namespace StudioManagement.Business.Auth;

public interface IPasswordResetService
{
    Task RequestResetAsync(string email, CancellationToken ct = default);
    Task<PasswordResetResult> ResetPasswordAsync(string token, string newPassword, CancellationToken ct = default);
}
