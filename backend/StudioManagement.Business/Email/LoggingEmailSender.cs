using Microsoft.Extensions.Logging;
using StudioManagement.Business.Common;

namespace StudioManagement.Business.Email;

// Fallback used whenever no SMTP host is configured — prints the email to the log instead of
// sending it, so password-reset flows stay fully testable in dev without real mail infrastructure.
public class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string toEmail, string subject, string body, CancellationToken ct = default)
    {
        // The body can hold a reset code, so it's only written at Debug (enabled for this class in
        // development settings, never on a server); the normal line carries no secret.
        logger.LogInformation("Email NOT sent (no SMTP configured) to {ToEmail}: {Subject}", LogMask.Email(toEmail), subject);
        logger.LogDebug("Email body for {ToEmail} (development only):\n{Body}", toEmail, body);
        return Task.CompletedTask;
    }
}
