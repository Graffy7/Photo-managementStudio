namespace StudioManagement.Business.Billing;

public record GatewayOrder(string OrderId, long AmountMinor, string Currency);

// A payment as the gateway itself reports it (never as the browser claims it).
public record GatewayPayment(string PaymentId, string? OrderId, string Status, long AmountMinor, string Currency, string? Method, string? ErrorDescription);

// The online payment provider. Card/UPI/net-banking details are entered on the provider's own
// checkout and never pass through this server.
public interface IPaymentGateway
{
    string Name { get; }

    // False until the keys are configured; checkout is then refused with a clear message.
    bool IsConfigured { get; }

    // The public key the browser checkout needs (safe to expose; the secret never leaves the server).
    string? PublicKey { get; }

    Task<GatewayOrder> CreateOrderAsync(long amountMinor, string currency, string receipt, IDictionary<string, string> notes, CancellationToken ct = default);
    Task<GatewayPayment> FetchPaymentAsync(string paymentId, CancellationToken ct = default);
    Task<GatewayPayment> CapturePaymentAsync(string paymentId, long amountMinor, string currency, CancellationToken ct = default);

    // Proves the checkout result really came from the gateway for this order.
    bool VerifyCheckoutSignature(string orderId, string paymentId, string signature);

    // Proves a webhook body was sent by the gateway.
    bool VerifyWebhookSignature(string rawBody, string signature);
}

public class GatewayException(string message, Exception? inner = null) : Exception(message, inner);
