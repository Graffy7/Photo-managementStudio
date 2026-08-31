using Microsoft.Extensions.Logging;

namespace StudioManagement.Business.Email;

// Fallback used whenever no SMTP host is configured — prints the email to the log instead of
// sending it, so password-reset flows stay fully testable in dev without real mail infrastructure.
public class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string toEmail, string subject, string body, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Email (no SMTP configured, logging instead) — To: {ToEmail}, Subject: {Subject}\n{Body}",
            toEmail, subject, body);
        return Task.CompletedTask;
    }
}
