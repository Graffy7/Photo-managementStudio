using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using StudioManagement.Business.Billing;

namespace StudioManagement.API.Infrastructure;

// Bound from "Payments:Razorpay". Keep the secrets out of appsettings.json in production (user
// secrets / environment variables): Payments__Razorpay__KeySecret, Payments__Razorpay__WebhookSecret.
public class RazorpayOptions
{
    public string KeyId { get; set; } = "";
    public string KeySecret { get; set; } = "";
    public string WebhookSecret { get; set; } = "";
    public string ApiBaseUrl { get; set; } = "https://api.razorpay.com/v1/";
}

// Razorpay (UPI, cards, net banking, wallets in one checkout). Orders are created and payments are
// confirmed server-to-server with the secret key; signatures are HMAC-SHA256 as Razorpay documents.
public class RazorpayGateway(HttpClient http, RazorpayOptions options) : IPaymentGateway
{
    public string Name => "Razorpay";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.KeyId) && !string.IsNullOrWhiteSpace(options.KeySecret);

    public string? PublicKey => IsConfigured ? options.KeyId : null;

    public async Task<GatewayOrder> CreateOrderAsync(long amountMinor, string currency, string receipt, IDictionary<string, string> notes, CancellationToken ct = default)
    {
        var body = new Dictionary<string, object>
        {
            ["amount"] = amountMinor,
            ["currency"] = currency,
            ["receipt"] = receipt,
            // Capture automatically once the customer pays; nothing is left merely "authorized".
            ["payment_capture"] = 1,
            ["notes"] = notes
        };
        using var doc = await SendAsync(HttpMethod.Post, "orders", body, ct);
        var root = doc.RootElement;
        return new GatewayOrder(root.GetProperty("id").GetString()!, root.GetProperty("amount").GetInt64(), root.GetProperty("currency").GetString()!);
    }

    public async Task<GatewayPayment> FetchPaymentAsync(string paymentId, CancellationToken ct = default)
    {
        using var doc = await SendAsync(HttpMethod.Get, $"payments/{Uri.EscapeDataString(paymentId)}", null, ct);
        return ReadPayment(doc.RootElement);
    }

    public async Task<GatewayPayment> CapturePaymentAsync(string paymentId, long amountMinor, string currency, CancellationToken ct = default)
    {
        using var doc = await SendAsync(HttpMethod.Post, $"payments/{Uri.EscapeDataString(paymentId)}/capture",
            new Dictionary<string, object> { ["amount"] = amountMinor, ["currency"] = currency }, ct);
        return ReadPayment(doc.RootElement);
    }

    public bool VerifyCheckoutSignature(string orderId, string paymentId, string signature) =>
        IsConfigured && Matches($"{orderId}|{paymentId}", options.KeySecret, signature);

    public bool VerifyWebhookSignature(string rawBody, string signature) =>
        !string.IsNullOrWhiteSpace(options.WebhookSecret) && Matches(rawBody, options.WebhookSecret, signature);

    internal static GatewayPayment ReadPayment(JsonElement p) => new(
        p.GetProperty("id").GetString()!,
        p.TryGetProperty("order_id", out var o) && o.ValueKind == JsonValueKind.String ? o.GetString() : null,
        p.GetProperty("status").GetString()!,
        p.GetProperty("amount").GetInt64(),
        p.TryGetProperty("currency", out var c) ? c.GetString() ?? "INR" : "INR",
        p.TryGetProperty("method", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null,
        p.TryGetProperty("error_description", out var e) && e.ValueKind == JsonValueKind.String ? e.GetString() : null);

    // Constant-time comparison of the expected HMAC with the one supplied.
    private static bool Matches(string payload, string secret, string signature)
    {
        if (string.IsNullOrWhiteSpace(signature))
        {
            return false;
        }

        var expected = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(payload)));
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(signature.Trim().ToLowerInvariant()));
    }

    private async Task<JsonDocument> SendAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        if (!IsConfigured)
        {
            throw new GatewayException("Online payments are not set up.");
        }

        using var request = new HttpRequestMessage(method, new Uri(new Uri(options.ApiBaseUrl), path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{options.KeyId}:{options.KeySecret}")));
        if (body is not null)
        {
            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        }

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new GatewayException("The payment provider couldn't be reached.", ex);
        }

        using (response)
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                string? detail = null;
                try { detail = JsonDocument.Parse(text).RootElement.GetProperty("error").GetProperty("description").GetString(); } catch { }
                throw new GatewayException(detail ?? $"The payment provider returned {(int)response.StatusCode}.");
            }
            return JsonDocument.Parse(text);
        }
    }
}
