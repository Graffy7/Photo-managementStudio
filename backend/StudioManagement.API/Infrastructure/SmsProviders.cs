using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using StudioManagement.Business.Sms;

namespace StudioManagement.API.Infrastructure;

// Sms:Twilio:* - AccountSid, AuthToken (secret), and either From (a Twilio number) or
// MessagingServiceSid. Keys come from user-secrets / environment only.
public class TwilioOptions
{
    public string? AccountSid { get; set; }
    public string? AuthToken { get; set; }
    public string? From { get; set; }
    public string? MessagingServiceSid { get; set; }
    public string ApiBaseUrl { get; set; } = "https://api.twilio.com";
}

public class TwilioSmsSender(HttpClient http, TwilioOptions options, IConfiguration configuration, ILogger<TwilioSmsSender> logger) : ISmsSender
{
    public async Task SendVerificationCodeAsync(string phoneNumber, string code, int expiryMinutes, CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["To"] = SmsText.ToE164(phoneNumber, configuration["Sms:DefaultCountryCode"] ?? "91"),
            ["Body"] = SmsText.VerificationCode(code, expiryMinutes)
        };
        if (!string.IsNullOrWhiteSpace(options.MessagingServiceSid)) form["MessagingServiceSid"] = options.MessagingServiceSid;
        else form["From"] = options.From!;

        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{options.ApiBaseUrl.TrimEnd('/')}/2010-04-01/Accounts/{options.AccountSid}/Messages.json")
        {
            Content = new FormUrlEncodedContent(form)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{options.AccountSid}:{options.AuthToken}")));

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            // Twilio's error body names the problem (never contains our secret) - worth logging.
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Twilio SMS failed ({Status}): {Body}", (int)response.StatusCode, body.Length > 300 ? body[..300] : body);
            throw new InvalidOperationException($"SMS provider returned {(int)response.StatusCode}.");
        }
    }
}

// Sms:Msg91:* - AuthKey (secret) and TemplateId: the DLT-approved MSG91 "flow" template, whose
// variable for the code is CodeVariable (default "otp") and, optionally, MinutesVariable.
public class Msg91Options
{
    public string? AuthKey { get; set; }
    public string? TemplateId { get; set; }
    public string CodeVariable { get; set; } = "otp";
    public string? MinutesVariable { get; set; }
    public string ApiBaseUrl { get; set; } = "https://control.msg91.com";
}

public class Msg91SmsSender(HttpClient http, Msg91Options options, IConfiguration configuration, ILogger<Msg91SmsSender> logger) : ISmsSender
{
    public async Task SendVerificationCodeAsync(string phoneNumber, string code, int expiryMinutes, CancellationToken ct = default)
    {
        var recipient = new Dictionary<string, string>
        {
            // MSG91 wants the number with country code and no "+".
            ["mobiles"] = SmsText.ToE164(phoneNumber, configuration["Sms:DefaultCountryCode"] ?? "91").TrimStart('+'),
            [options.CodeVariable] = code
        };
        if (!string.IsNullOrWhiteSpace(options.MinutesVariable)) recipient[options.MinutesVariable] = expiryMinutes.ToString();

        var payload = JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["template_id"] = options.TemplateId!,
            ["short_url"] = "0",
            ["recipients"] = new[] { recipient }
        });
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{options.ApiBaseUrl.TrimEnd('/')}/api/v5/flow/")
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("authkey", options.AuthKey);

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        // MSG91 can answer 200 with {"type":"error",...}.
        if (!response.IsSuccessStatusCode || body.Contains("\"type\":\"error\"", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError("MSG91 SMS failed ({Status}): {Body}", (int)response.StatusCode, body.Length > 300 ? body[..300] : body);
            throw new InvalidOperationException($"SMS provider returned {(int)response.StatusCode}.");
        }
    }
}
