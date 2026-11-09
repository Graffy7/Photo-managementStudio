using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace StudioManagement.Business.WhatsApp;

// One delivery receipt from Meta: sent -> delivered -> read, or failed (with Meta's error).
public record WhatsAppStatusUpdate(
    string MessageId, string Status, string RecipientMasked, DateTime At, int? ErrorCode = null, string? ErrorTitle = null);

// A message someone sent to the business number (only what's needed to log it; never the text).
public record WhatsAppIncomingMessage(string MessageId, string FromMasked, string Type, DateTime At);

public record WhatsAppWebhookPayload(List<WhatsAppStatusUpdate> Statuses, List<WhatsAppIncomingMessage> Messages);

// The Meta side of the webhook: the subscription handshake, the signature on every call, and reading
// the JSON Meta posts. No studio data is touched here.
public static class WhatsAppWebhook
{
    // GET handshake when the webhook is saved in the Meta app: hub.mode=subscribe and our verify token.
    public static bool IsValidSubscription(string? mode, string? token, string expected) =>
        mode == "subscribe" && !string.IsNullOrEmpty(expected) && !string.IsNullOrEmpty(token) &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(token), Encoding.UTF8.GetBytes(expected));

    // X-Hub-Signature-256: "sha256=" + hex HMAC-SHA256 of the exact request bytes, keyed with the app secret.
    public static bool IsValidSignature(byte[] body, string? header, string appSecret)
    {
        if (string.IsNullOrEmpty(appSecret) || string.IsNullOrWhiteSpace(header) || !header.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var expected = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(appSecret), body));
        var given = header["sha256=".Length..].Trim().ToLowerInvariant();
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(given));
    }

    // { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [...], messages: [...] } }] }] }
    public static WhatsAppWebhookPayload Parse(byte[] body)
    {
        var statuses = new List<WhatsAppStatusUpdate>();
        var messages = new List<WhatsAppIncomingMessage>();
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
        {
            return new WhatsAppWebhookPayload(statuses, messages);
        }

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array) continue;
            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Object) continue;

                if (value.TryGetProperty("statuses", out var list) && list.ValueKind == JsonValueKind.Array)
                {
                    foreach (var s in list.EnumerateArray())
                    {
                        int? code = null;
                        string? title = null;
                        if (s.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Array && errors.GetArrayLength() > 0)
                        {
                            var e = errors[0];
                            code = e.TryGetProperty("code", out var c) && c.TryGetInt32(out var n) ? n : null;
                            title = Text(e, "title") ?? Text(e, "message");
                        }
                        statuses.Add(new WhatsAppStatusUpdate(
                            Text(s, "id") ?? "", Text(s, "status") ?? "unknown", WhatsAppPhone.Mask(Text(s, "recipient_id") ?? ""),
                            Time(s), code, title));
                    }
                }

                if (value.TryGetProperty("messages", out var incoming) && incoming.ValueKind == JsonValueKind.Array)
                {
                    foreach (var m in incoming.EnumerateArray())
                    {
                        messages.Add(new WhatsAppIncomingMessage(Text(m, "id") ?? "", WhatsAppPhone.Mask(Text(m, "from") ?? ""), Text(m, "type") ?? "unknown", Time(m)));
                    }
                }
            }
        }

        return new WhatsAppWebhookPayload(statuses, messages);
    }

    private static string? Text(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    // Meta sends Unix seconds as a string.
    private static DateTime Time(JsonElement e) =>
        long.TryParse(Text(e, "timestamp"), out var seconds) ? DateTimeOffset.FromUnixTimeSeconds(seconds).UtcDateTime : DateTime.UtcNow;
}

// The latest receipts per message, in memory, so the admin can see whether a test message arrived.
// Bounded; nothing here survives a restart (the application log keeps the full history).
public class WhatsAppDeliveryTracker
{
    private const int Capacity = 500;
    private readonly ConcurrentDictionary<string, List<WhatsAppStatusUpdate>> byMessage = new();
    private readonly ConcurrentQueue<string> order = new();

    public void Record(WhatsAppStatusUpdate update)
    {
        if (string.IsNullOrEmpty(update.MessageId)) return;
        var list = byMessage.GetOrAdd(update.MessageId, id =>
        {
            order.Enqueue(id);
            return [];
        });
        lock (list) list.Add(update);

        while (order.Count > Capacity && order.TryDequeue(out var oldest))
        {
            byMessage.TryRemove(oldest, out _);
        }
    }

    public IReadOnlyList<WhatsAppStatusUpdate> Get(string messageId)
    {
        if (!byMessage.TryGetValue(messageId, out var list)) return [];
        lock (list) return list.OrderBy(u => u.At).ToList();
    }
}
