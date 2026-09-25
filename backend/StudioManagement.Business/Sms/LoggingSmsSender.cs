using Microsoft.Extensions.Logging;

namespace StudioManagement.Business.Sms;

// Development stand-in (Sms:Provider = "Log"): writes the text to the log instead of sending it,
// so phone codes can be tested before an SMS provider is signed up.
public class LoggingSmsSender(ILogger<LoggingSmsSender> logger) : ISmsSender
{
    public Task SendAsync(string phoneNumber, string message, CancellationToken ct = default)
    {
        logger.LogInformation("SMS (no SMS provider, logging instead) — To: {Phone}\n{Message}", phoneNumber, message);
        return Task.CompletedTask;
    }
}
