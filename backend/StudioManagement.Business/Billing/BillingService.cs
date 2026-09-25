using System.Text.Json;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Audit;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Billing;

public enum BillingFailure
{
    NotConfigured,
    PlanNotFound,
    OrderNotFound,
    InvalidSignature,
    NotPaid,
    Mismatch,
    GatewayError
}

public class BillingResult<T>
{
    public T? Value { get; private init; }
    public BillingFailure? Failure { get; private init; }
    public string? Message { get; private init; }
    public bool Succeeded => Failure is null;

    public static BillingResult<T> Ok(T value) => new() { Value = value };
    public static BillingResult<T> Fail(BillingFailure failure, string? message = null) => new() { Failure = failure, Message = message };
}

public interface IBillingService
{
    Task<SubscriptionStatusDto> GetStatusAsync(int studioId, CancellationToken ct = default);
    Task<BillingResult<CheckoutDto>> CreateCheckoutAsync(int studioId, int userId, int planId, CancellationToken ct = default);
    Task<BillingResult<SubscriptionStatusDto>> VerifyAsync(int studioId, VerifyPaymentRequestDto request, CancellationToken ct = default);
    Task ReportFailureAsync(int studioId, PaymentFailedRequestDto request, CancellationToken ct = default);

    // A gateway webhook: true when it was authentic (whatever it said), false when it must be refused.
    Task<bool> HandleWebhookAsync(string rawBody, string? signature, string? eventId, CancellationToken ct = default);
}

// Online subscription purchases. The browser only ever *starts* a payment; whether it succeeded is
// decided here, from the gateway itself (signature + a server-to-server fetch), and a successful
// payment is applied to the subscription exactly once - no matter how many times the browser
// callback or the webhook tells us about it.
public class BillingService(
    IPaymentGateway gateway,
    ISubscriptionOrderRepository orderRepository,
    IRepository<SubscriptionPlan> planRepository,
    IStudioRepository studioRepository,
    IStudioSubscriptionRepository subscriptionRepository,
    IUserRepository userRepository,
    IAdminConsoleRepository readModel,
    ISubscriptionLedger ledger,
    IStudioAccessService accessService,
    IAuditService auditService,
    IUnitOfWork unitOfWork,
    ILogger<BillingService> logger) : IBillingService
{
    private const string Module = "Subscriptions";
    private const string Currency = "INR";
    private static readonly TimeSpan ReuseOpenOrderFor = TimeSpan.FromMinutes(15);

    // ---- Status --------------------------------------------------------------------------------

    public async Task<SubscriptionStatusDto> GetStatusAsync(int studioId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var access = await accessService.GetAsync(studioId, ct);
        var current = await subscriptionRepository.GetCurrentAsync(studioId, ct);
        var plans = await SellablePlansAsync(ct);
        var payments = await readModel.GetPaymentsAsync(studioId, ct);
        var orders = await orderRepository.GetForStudioAsync(studioId, ct);

        var running = current is not null && current.Status != SubscriptionStatuses.Cancelled && current.EndDate > now;
        // Renewing a running paid plan adds onto its expiry; anything else starts today.
        var renewFrom = running && !current!.IsTrial ? current.EndDate : now;

        var paidOrderPaymentIds = orders.Where(o => o.SubscriptionPaymentId is not null).Select(o => o.SubscriptionPaymentId!.Value).ToHashSet();
        var history = new List<BillingHistoryItemDto>();
        foreach (var o in orders)
        {
            history.Add(new BillingHistoryItemDto
            {
                Kind = "Online",
                Date = o.PaidAt ?? o.CreatedAt,
                PlanName = o.SubscriptionPlan.PlanName,
                Months = o.Months,
                Amount = o.Amount,
                Status = o.Status == PaymentOrderStatuses.Paid ? "Paid" : o.Status == PaymentOrderStatuses.Failed ? "Failed" : "Pending",
                Method = o.PaymentMethod,
                TransactionId = o.GatewayPaymentId,
                OrderId = o.GatewayOrderId,
                PeriodStart = payments.FirstOrDefault(p => p.SubscriptionPaymentId == o.SubscriptionPaymentId)?.PeriodStart,
                PeriodEnd = payments.FirstOrDefault(p => p.SubscriptionPaymentId == o.SubscriptionPaymentId)?.PeriodEnd,
                FailureReason = o.FailureReason
            });
        }
        foreach (var p in payments.Where(p => !paidOrderPaymentIds.Contains(p.SubscriptionPaymentId)))
        {
            history.Add(new BillingHistoryItemDto
            {
                Kind = "Manual",
                Date = p.PaymentDate,
                PlanName = p.StudioSubscription.SubscriptionPlan.PlanName,
                Months = p.PeriodStart is { } s && p.PeriodEnd is { } e ? Math.Max(0, (int)Math.Round((e - s).TotalDays / 30.4375)) : 0,
                Amount = p.Amount,
                Status = "Paid",
                Method = p.PaymentMethod,
                TransactionId = p.ReferenceNumber,
                PeriodStart = p.PeriodStart,
                PeriodEnd = p.PeriodEnd
            });
        }
        history = history.OrderByDescending(h => h.Date).ToList();
        var last = history.FirstOrDefault(h => h.Status == "Paid");
        var lastAttempt = history.FirstOrDefault();

        return new SubscriptionStatusDto
        {
            HasAccess = access.HasAccess,
            AccessLevel = access.Level.ToString(),
            Status = access.Reason switch
            {
                "ComplimentaryAccess" => "Complimentary",
                "ReadOnlyByAdmin" => "ReadOnly",
                _ => access.Reason
            },
            IsTrial = current?.IsTrial ?? false,
            PlanName = current is null ? null : current.IsTrial ? "Free trial" : current.SubscriptionPlan.PlanName,
            StartDate = current?.StartDate,
            ExpiryDate = current?.EndDate,
            DaysRemaining = running ? (int)Math.Ceiling((current!.EndDate - now).TotalDays) : 0,
            LastAmountPaid = last?.Amount,
            LastPaymentStatus = lastAttempt?.Status,
            LastPaymentDate = lastAttempt?.Date,
            AutoRenew = false,
            OnlinePaymentsAvailable = gateway.IsConfigured,
            ServerTime = now,
            Plans = plans.Select(p => new PlanDto
            {
                PlanId = p.SubscriptionPlanId,
                Name = p.PlanName,
                Months = p.DurationMonths,
                Price = p.Price,
                PricePerMonth = Math.Round(p.Price / p.DurationMonths, 0),
                Description = p.Description,
                NewExpiry = renewFrom.AddMonths(p.DurationMonths)
            }).ToList(),
            History = history
        };
    }

    private async Task<List<SubscriptionPlan>> SellablePlansAsync(CancellationToken ct) =>
        (await planRepository.GetAllAsync(ct)).Where(p => p.IsActive && p.DurationMonths > 0).OrderBy(p => p.DurationMonths).ToList();

    // ---- Checkout ------------------------------------------------------------------------------

    public async Task<BillingResult<CheckoutDto>> CreateCheckoutAsync(int studioId, int userId, int planId, CancellationToken ct = default)
    {
        if (!gateway.IsConfigured)
        {
            return BillingResult<CheckoutDto>.Fail(BillingFailure.NotConfigured);
        }

        var plan = (await SellablePlansAsync(ct)).FirstOrDefault(p => p.SubscriptionPlanId == planId);
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (plan is null || studio is null)
        {
            return BillingResult<CheckoutDto>.Fail(BillingFailure.PlanNotFound);
        }

        var user = await userRepository.GetByIdAsync(userId, ct);
        var amountMinor = (long)Math.Round(plan.Price * 100m);
        var now = DateTime.UtcNow;

        // A second click (or reopening the checkout) reuses the order still waiting for payment.
        var order = await orderRepository.GetRecentOpenAsync(studioId, planId, now - ReuseOpenOrderFor, ct);
        if (order is null || (long)Math.Round(order.Amount * 100m) != amountMinor)
        {
            GatewayOrder created;
            try
            {
                created = await gateway.CreateOrderAsync(amountMinor, Currency, $"studio-{studioId}-{now:yyyyMMddHHmmss}",
                    new Dictionary<string, string> { ["studioId"] = studioId.ToString(), ["planId"] = planId.ToString(), ["plan"] = plan.PlanName }, ct);
            }
            catch (GatewayException ex)
            {
                logger.LogWarning(ex, "Creating a payment order failed for studio {StudioId}", studioId);
                return BillingResult<CheckoutDto>.Fail(BillingFailure.GatewayError, ex.Message);
            }

            order = new SubscriptionOrder
            {
                StudioId = studioId,
                SubscriptionPlanId = planId,
                Amount = plan.Price,
                Currency = Currency,
                Months = plan.DurationMonths,
                Gateway = gateway.Name,
                GatewayOrderId = created.OrderId,
                Status = PaymentOrderStatuses.Created,
                CreatedAt = now,
                UpdatedAt = now
            };
            await orderRepository.AddAsync(order, ct);
            await auditService.LogAsync($"Checkout started: {plan.PlanName} ₹{plan.Price:0.##}", Module, studioId, ct);
        }

        return BillingResult<CheckoutDto>.Ok(new CheckoutDto
        {
            Gateway = gateway.Name,
            KeyId = gateway.PublicKey!,
            OrderId = order.GatewayOrderId,
            Amount = amountMinor,
            Currency = Currency,
            PlanName = plan.PlanName,
            StudioName = studio.StudioName,
            Email = user?.Email,
            Phone = studio.PhoneNumber
        });
    }

    // ---- Browser callback ----------------------------------------------------------------------

    public async Task<BillingResult<SubscriptionStatusDto>> VerifyAsync(int studioId, VerifyPaymentRequestDto request, CancellationToken ct = default)
    {
        var order = await orderRepository.GetByGatewayOrderIdAsync(request.OrderId, ct);
        if (order is null || order.StudioId != studioId)
        {
            return BillingResult<SubscriptionStatusDto>.Fail(BillingFailure.OrderNotFound);
        }
        if (!gateway.VerifyCheckoutSignature(request.OrderId, request.PaymentId, request.Signature))
        {
            logger.LogWarning("Rejected a payment callback with a bad signature (studio {StudioId}, order {OrderId})", studioId, request.OrderId);
            return BillingResult<SubscriptionStatusDto>.Fail(BillingFailure.InvalidSignature);
        }

        // The signature proves the ids came from the gateway; the payment's actual state still comes
        // from the gateway itself.
        GatewayPayment payment;
        try
        {
            payment = await gateway.FetchPaymentAsync(request.PaymentId, ct);
        }
        catch (GatewayException ex)
        {
            return BillingResult<SubscriptionStatusDto>.Fail(BillingFailure.GatewayError, ex.Message);
        }

        var applied = await ApplyAsync(order, payment, "checkout", ct);
        if (applied is not null)
        {
            return BillingResult<SubscriptionStatusDto>.Fail(applied.Value.Failure, applied.Value.Message);
        }

        return BillingResult<SubscriptionStatusDto>.Ok(await GetStatusAsync(studioId, ct));
    }

    public async Task ReportFailureAsync(int studioId, PaymentFailedRequestDto request, CancellationToken ct = default)
    {
        var order = await orderRepository.GetByGatewayOrderIdAsync(request.OrderId, ct);
        if (order is null || order.StudioId != studioId)
        {
            return;
        }

        var reason = string.IsNullOrWhiteSpace(request.Reason) ? "Payment was not completed." : request.Reason.Trim();
        if (await orderRepository.MarkFailedAsync(order.SubscriptionOrderId, Truncate(reason, 300), null, DateTime.UtcNow, ct))
        {
            await auditService.LogAsync($"Payment failed: {Truncate(reason, 60)}", Module, studioId, ct);
        }
    }

    // ---- Webhook -------------------------------------------------------------------------------

    public async Task<bool> HandleWebhookAsync(string rawBody, string? signature, string? eventId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(signature) || !gateway.VerifyWebhookSignature(rawBody, signature))
        {
            logger.LogWarning("Rejected a payment webhook with a missing or bad signature");
            return false;
        }

        JsonElement root;
        try
        {
            root = JsonDocument.Parse(rawBody).RootElement;
        }
        catch (JsonException)
        {
            return false;
        }

        var type = root.TryGetProperty("event", out var ev) ? ev.GetString() ?? "" : "";
        JsonElement? paymentEntity = root.TryGetProperty("payload", out var payload) && payload.TryGetProperty("payment", out var pay) && pay.TryGetProperty("entity", out var ent)
            ? ent : null;
        var payment = paymentEntity is { } pe ? ReadPayment(pe) : null;

        var evt = new PaymentGatewayEvent
        {
            Gateway = gateway.Name,
            EventId = string.IsNullOrWhiteSpace(eventId) ? $"{type}:{payment?.PaymentId}:{payment?.Status}" : eventId,
            EventType = Truncate(type, 60)!,
            GatewayOrderId = payment?.OrderId,
            GatewayPaymentId = payment?.PaymentId,
            Outcome = "Received",
            ReceivedAt = DateTime.UtcNow
        };
        if (!await orderRepository.TryRecordEventAsync(evt, ct))
        {
            return true;   // already handled this delivery
        }

        if (payment?.OrderId is null)
        {
            return true;   // an event we don't act on
        }

        var order = await orderRepository.GetByGatewayOrderIdAsync(payment.OrderId, ct);
        if (order is null)
        {
            logger.LogWarning("Payment webhook for an unknown order {OrderId}", payment.OrderId);
            return true;
        }

        switch (type)
        {
            case "payment.captured":
            case "payment.authorized":
            case "order.paid":
                await ApplyAsync(order, payment, "webhook", ct);
                break;
            case "payment.failed":
                if (await orderRepository.MarkFailedAsync(order.SubscriptionOrderId, Truncate(payment.ErrorDescription ?? "Payment failed.", 300), payment.PaymentId, DateTime.UtcNow, ct))
                {
                    await auditService.LogAsync($"Payment failed ({payment.Method ?? "online"})", Module, order.StudioId, ct);
                }
                break;
        }

        return true;
    }

    private static GatewayPayment ReadPayment(JsonElement p) => new(
        p.GetProperty("id").GetString()!,
        p.TryGetProperty("order_id", out var o) && o.ValueKind == JsonValueKind.String ? o.GetString() : null,
        p.GetProperty("status").GetString()!,
        p.GetProperty("amount").GetInt64(),
        p.TryGetProperty("currency", out var c) ? c.GetString() ?? "INR" : "INR",
        p.TryGetProperty("method", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null,
        p.TryGetProperty("error_description", out var e) && e.ValueKind == JsonValueKind.String ? e.GetString() : null);

    // ---- Applying a successful payment (exactly once) -------------------------------------------

    // Null on success (including "already applied"); otherwise why it wasn't applied.
    private async Task<(BillingFailure Failure, string Message)?> ApplyAsync(SubscriptionOrder order, GatewayPayment payment, string via, CancellationToken ct)
    {
        var expectedMinor = (long)Math.Round(order.Amount * 100m);
        if (payment.OrderId != order.GatewayOrderId || payment.AmountMinor != expectedMinor ||
            !string.Equals(payment.Currency, order.Currency, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("Payment {PaymentId} doesn't match order {OrderId} (amount/currency/order)", payment.PaymentId, order.GatewayOrderId);
            return (BillingFailure.Mismatch, "This payment doesn't match the order.");
        }

        if (payment.Status == "authorized")
        {
            try
            {
                payment = await gateway.CapturePaymentAsync(payment.PaymentId, expectedMinor, order.Currency, ct);
            }
            catch (GatewayException ex)
            {
                return (BillingFailure.GatewayError, ex.Message);
            }
        }
        if (payment.Status != "captured")
        {
            if (payment.Status == "failed")
            {
                await orderRepository.MarkFailedAsync(order.SubscriptionOrderId, Truncate(payment.ErrorDescription ?? "Payment failed.", 300), payment.PaymentId, DateTime.UtcNow, ct);
            }
            return (BillingFailure.NotPaid, "The payment hasn't gone through.");
        }

        var applied = await unitOfWork.ExecuteInTransactionAsync(async token =>
        {
            // Only the first caller moves the order to Paid; everyone after that is a duplicate.
            if (!await orderRepository.TryMarkPaidAsync(order.SubscriptionOrderId, payment.PaymentId, payment.Method, DateTime.UtcNow, token))
            {
                return false;
            }

            var plan = order.SubscriptionPlan;
            var recorded = await ledger.RecordAsync(new LedgerEntry(
                order.StudioId, plan, order.Months, order.Amount, DateTime.UtcNow,
                MethodLabel(payment.Method), payment.PaymentId, $"Online payment ({gateway.Name} {payment.Method ?? ""}) · order {order.GatewayOrderId}"), token);
            await orderRepository.LinkPaymentAsync(order.SubscriptionOrderId, recorded.SubscriptionPaymentId, token);
            return true;
        }, ct);

        accessService.Invalidate(order.StudioId);
        if (applied)
        {
            await auditService.LogAsync($"Subscription paid online: {order.SubscriptionPlan.PlanName} ₹{order.Amount:0.##} ({via})", Module, order.StudioId, ct);
        }
        return null;
    }

    private static string MethodLabel(string? gatewayMethod) => gatewayMethod?.ToLowerInvariant() switch
    {
        "upi" => PaymentMethods.Upi,
        "card" or "emi" => PaymentMethods.Card,
        "netbanking" => PaymentMethods.BankTransfer,
        _ => PaymentMethods.Other
    };

    private static string? Truncate(string? v, int max) => v is null || v.Length <= max ? v : v[..max];
}
