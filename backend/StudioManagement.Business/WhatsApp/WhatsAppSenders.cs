using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace StudioManagement.Business.WhatsApp;

public record WhatsAppSendResult(bool Success, string? Error = null, bool Simulated = false);

// The one place that talks to WhatsApp. Everything above it decides WHO gets WHAT; this only delivers
// a piece of text to a phone number.
public interface IWhatsAppSender
{
    string ProviderName { get; }
    Task<WhatsAppSendResult> SendAsync(string phoneNumber, string text, CancellationToken ct = default);
}

// Default provider: writes the message to the log instead of sending it.
public class LoggingWhatsAppSender(ILogger<LoggingWhatsAppSender> logger) : IWhatsAppSender
{
    public string ProviderName => WhatsAppOptions.LogProvider;

    public Task<WhatsAppSendResult> SendAsync(string phoneNumber, string text, CancellationToken ct = default)
    {
        logger.LogInformation(
            "WhatsApp message NOT sent (no provider configured) to {Phone}: {Length} characters",
            WhatsAppPhone.Mask(phoneNumber), text.Length);
        logger.LogDebug("WhatsApp message body:\n{Body}", text);
        return Task.FromResult(new WhatsAppSendResult(true, null, Simulated: true));
    }
}

// WhatsApp Business Cloud API (Meta). Plain text messages, which Meta only delivers to a person who has
// messaged the business number in the last 24 hours (or to test recipients); reaching everyone at any
// time needs an approved message template.
public class CloudApiWhatsAppSender(WhatsAppOptions options, ILogger<CloudApiWhatsAppSender> logger) : IWhatsAppSender
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(30) };

    public string ProviderName => WhatsAppOptions.CloudApiProvider;

    public async Task<WhatsAppSendResult> SendAsync(string phoneNumber, string text, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.PhoneNumberId) || string.IsNullOrWhiteSpace(options.AccessToken))
        {
            return new WhatsAppSendResult(false, "WhatsApp is not set up (missing PhoneNumberId or AccessToken).");
        }

        var url = $"https://graph.facebook.com/{options.ApiVersion}/{options.PhoneNumberId}/messages";
        var body = JsonSerializer.Serialize(new
        {
            messaging_product = "whatsapp",
            to = phoneNumber,
            type = "text",
            text = new { preview_url = true, body = text }
        });

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.AccessToken);

            using var response = await Http.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                return new WhatsAppSendResult(true);
            }

            var error = await ReadErrorAsync(response, ct);
            logger.LogWarning("WhatsApp send to {Phone} failed: {Status} {Error}", WhatsAppPhone.Mask(phoneNumber), (int)response.StatusCode, error);
            return new WhatsAppSendResult(false, error);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            if (ct.IsCancellationRequested)
            {
                throw;
            }

            logger.LogWarning(ex, "WhatsApp send to {Phone} failed", WhatsAppPhone.Mask(phoneNumber));
            return new WhatsAppSendResult(false, "Couldn't reach WhatsApp. Check the internet connection.");
        }
    }

    private static async Task<string> ReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            if (doc.RootElement.TryGetProperty("error", out var error) && error.TryGetProperty("message", out var message))
            {
                var text = message.GetString() ?? "WhatsApp rejected the message.";
                return text.Length > 300 ? text[..300] : text;
            }
        }
        catch (JsonException)
        {
        }

        return $"WhatsApp rejected the message ({(int)response.StatusCode}).";
    }
}
