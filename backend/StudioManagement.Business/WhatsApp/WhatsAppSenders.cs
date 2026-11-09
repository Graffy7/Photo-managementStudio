using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace StudioManagement.Business.WhatsApp;

// MessageId: Meta's id for the sent message ("wamid..."); delivery receipts arriving on the webhook carry it.
public record WhatsAppSendResult(bool Success, string? Error = null, bool Simulated = false, string? MessageId = null, int? ErrorCode = null);

// An approved Meta message template and the values for its {{1}}, {{2}}... placeholders, in order.
// Language: the template's language code when it differs from WhatsApp:TemplateLanguage (e.g. "en_US").
public record WhatsAppTemplate(string Name, IReadOnlyList<string> Parameters, string? Language = null);

// The one place that talks to WhatsApp. Everything above it decides WHO gets WHAT; this only delivers
// a piece of text to a phone number.
public interface IWhatsAppSender
{
    string ProviderName { get; }
    // text is always given (the log, previews, and plain-text sending use it). When a template is
    // given and the provider supports templates, the template is sent instead of the text.
    Task<WhatsAppSendResult> SendAsync(string phoneNumber, string text, CancellationToken ct = default, WhatsAppTemplate? template = null);
}

// Default provider: writes the message to the log instead of sending it.
public class LoggingWhatsAppSender(ILogger<LoggingWhatsAppSender> logger) : IWhatsAppSender
{
    public string ProviderName => WhatsAppOptions.LogProvider;

    public Task<WhatsAppSendResult> SendAsync(string phoneNumber, string text, CancellationToken ct = default, WhatsAppTemplate? template = null)
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

    public async Task<WhatsAppSendResult> SendAsync(string phoneNumber, string text, CancellationToken ct = default, WhatsAppTemplate? template = null)
    {
        if (string.IsNullOrWhiteSpace(options.PhoneNumberId) || string.IsNullOrWhiteSpace(options.AccessToken))
        {
            return new WhatsAppSendResult(false, "WhatsApp is not set up (missing PhoneNumberId or AccessToken).");
        }

        var url = $"{options.ApiBaseUrl.TrimEnd('/')}/{options.ApiVersion}/{options.PhoneNumberId}/messages";
        var body = template is null
            ? JsonSerializer.Serialize(new
            {
                messaging_product = "whatsapp",
                to = phoneNumber,
                type = "text",
                text = new { preview_url = true, body = text }
            })
            : JsonSerializer.Serialize(new
            {
                messaging_product = "whatsapp",
                to = phoneNumber,
                type = "template",
                template = new
                {
                    name = template.Name,
                    language = new { code = template.Language ?? options.TemplateLanguage },
                    // A template without placeholders (e.g. Meta's hello_world) must be sent with no
                    // components at all - an empty parameter list is refused.
                    components = template.Parameters.Count == 0 ? null : new[]
                    {
                        new
                        {
                            type = "body",
                            // Meta refuses parameter values with line breaks, tabs or runs of spaces.
                            parameters = template.Parameters.Select(p => new { type = "text", text = CleanParameter(p) }).ToArray()
                        }
                    }
                }
            }, OmitNulls);

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.AccessToken);

            using var response = await Http.SendAsync(request, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            if (response.IsSuccessStatusCode)
            {
                var messageId = ReadMessageId(responseBody);
                logger.LogInformation("WhatsApp message {MessageId} accepted by Meta for {Phone}", messageId, WhatsAppPhone.Mask(phoneNumber));
                return new WhatsAppSendResult(true, MessageId: messageId);
            }

            var (error, code) = ReadError(responseBody, (int)response.StatusCode);
            logger.LogWarning("WhatsApp send to {Phone} failed: {Status} {Code} {Error}", WhatsAppPhone.Mask(phoneNumber), (int)response.StatusCode, code, error);
            return new WhatsAppSendResult(false, error, ErrorCode: code);
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

    private static string CleanParameter(string value)
    {
        var flat = string.Join(", ", value.Split(['\r', '\n', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        while (flat.Contains("    ")) flat = flat.Replace("    ", " ");
        return flat.Length == 0 ? "-" : flat;
    }

    private static readonly JsonSerializerOptions OmitNulls = new() { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    // {"messages":[{"id":"wamid..."}]}
    private static string? ReadMessageId(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("messages", out var messages) && messages.ValueKind == JsonValueKind.Array &&
                messages.GetArrayLength() > 0 && messages[0].TryGetProperty("id", out var id))
            {
                return id.GetString();
            }
        }
        catch (JsonException)
        {
        }

        return null;
    }

    // Meta's error message and code (e.g. 190 = invalid/expired token, 131030 = recipient not in the
    // test list, 132001 = template doesn't exist, 131047 = 24-hour window closed).
    private static (string Message, int? Code) ReadError(string body, int status)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var error) && error.TryGetProperty("message", out var message))
            {
                var text = message.GetString() ?? "WhatsApp rejected the message.";
                if (error.TryGetProperty("error_data", out var data) && data.TryGetProperty("details", out var details) && details.GetString() is { Length: > 0 } more)
                {
                    text = $"{text} {more}";
                }
                int? code = error.TryGetProperty("code", out var c) && c.TryGetInt32(out var n) ? n : null;
                return (text.Length > 300 ? text[..300] : text, code);
            }
        }
        catch (JsonException)
        {
        }

        return ($"WhatsApp rejected the message ({status}).", null);
    }
}
