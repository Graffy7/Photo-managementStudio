using Microsoft.Extensions.Logging;

namespace StudioManagement.Business.Sms;

// Development stand-in (Sms:Provider = "Log"): writes the text to the log instead of sending it,
// so phone codes can be tested before an SMS provider is signed up.
public class LoggingSmsSender(ILogger<LoggingSmsSender> logger) : ISmsSender
{
    public Task SendVerificationCodeAsync(string phoneNumber, string code, int expiryMinutes, CancellationToken ct = default)
    {
        logger.LogInformation("SMS (no SMS provider, logging instead) — To: {Phone}\n{Message}",
            phoneNumber, SmsText.VerificationCode(code, expiryMinutes));
        return Task.CompletedTask;
    }
}

public static class SmsText
{
    public static string VerificationCode(string code, int expiryMinutes) =>
        $"{code} is your Studio OS password reset code. It expires in {expiryMinutes} minutes. Do not share it with anyone.";

    // E.164 (+<country><number>): 10-digit local numbers get the default country code.
    public static string ToE164(string phone, string defaultCountryCode)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (phone.TrimStart().StartsWith('+')) return "+" + digits;
        if (digits.Length == 10 && !string.IsNullOrEmpty(defaultCountryCode)) return "+" + defaultCountryCode + digits;
        return "+" + digits;
    }
}
