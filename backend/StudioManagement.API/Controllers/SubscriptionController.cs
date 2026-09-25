using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.API.Filters;
using StudioManagement.Business.Billing;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

// A studio's own subscription: status, plans, and paying online. Usable while expired - it's how
// an expired studio renews.
[ApiController]
[Route("api/subscription")]
[Authorize(Roles = UserTypes.StudioOwner)]
[AllowWithoutSubscription]
public class SubscriptionController(
    IBillingService billingService,
    ITenantContext tenantContext,
    IValidator<VerifyPaymentRequestDto> verifyValidator) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId ?? throw new UnauthorizedAccessException();

    [HttpGet]
    public async Task<IActionResult> Status(CancellationToken ct) => Ok(await billingService.GetStatusAsync(StudioId, ct));

    [HttpPost("checkout")]
    [EnableRateLimiting("checkout")]
    public async Task<IActionResult> Checkout(CheckoutRequestDto request, CancellationToken ct)
    {
        var result = await billingService.CreateCheckoutAsync(StudioId, tenantContext.CurrentUserId ?? 0, request.PlanId, ct);
        if (result.Succeeded) return Ok(result.Value);

        return result.Failure switch
        {
            BillingFailure.NotConfigured => StatusCode(503, new { message = "Online payments aren't available yet. Please contact support to renew." }),
            BillingFailure.PlanNotFound => BadRequest(new { message = "That plan isn't available." }),
            _ => StatusCode(502, new { message = result.Message ?? "Couldn't start the payment. Please try again." })
        };
    }

    // Called by the browser after the gateway's checkout reports success. The payment only counts
    // once the server has verified it with the gateway.
    [HttpPost("verify")]
    [EnableRateLimiting("checkout")]
    public async Task<IActionResult> Verify(VerifyPaymentRequestDto request, CancellationToken ct)
    {
        var validation = await verifyValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await billingService.VerifyAsync(StudioId, request, ct);
        if (result.Succeeded) return Ok(result.Value);

        return result.Failure switch
        {
            BillingFailure.OrderNotFound => NotFound(new { message = "That payment wasn't found." }),
            BillingFailure.InvalidSignature or BillingFailure.Mismatch => BadRequest(new { message = "This payment couldn't be verified." }),
            BillingFailure.NotPaid => StatusCode(402, new { message = "The payment hasn't gone through. No money was taken for the plan." }),
            _ => StatusCode(502, new { message = "We couldn't confirm the payment with the provider yet. If money was taken, your plan will activate automatically within a few minutes." })
        };
    }

    [HttpPost("failed")]
    public async Task<IActionResult> Failed(PaymentFailedRequestDto request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.OrderId) && request.OrderId.Length <= 100)
        {
            await billingService.ReportFailureAsync(StudioId, request, ct);
        }
        return NoContent();
    }
}

public class VerifyPaymentRequestValidator : AbstractValidator<VerifyPaymentRequestDto>
{
    public VerifyPaymentRequestValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PaymentId).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Signature).NotEmpty().MaximumLength(200);
    }
}

// Server-to-server notifications from the payment gateway. No login - authenticity comes from the
// HMAC signature over the exact body, checked before anything is read.
[ApiController]
[Route("api/webhooks/razorpay")]
[AllowAnonymous]
public class PaymentWebhookController(IBillingService billingService) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(256 * 1024)]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);
        var ok = await billingService.HandleWebhookAsync(
            body, Request.Headers["X-Razorpay-Signature"].ToString(), Request.Headers["X-Razorpay-Event-Id"].ToString(), ct);
        return ok ? Ok() : BadRequest();
    }
}
