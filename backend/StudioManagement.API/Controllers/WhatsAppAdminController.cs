using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.Business.WhatsApp;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

// Platform admin only: is WhatsApp set up, send one test message, and see Meta's delivery receipts for it.
// No secret is ever returned - only whether each one is present.
[ApiController]
[Route("api/admin/whatsapp")]
[Authorize(Roles = UserTypes.SuperAdmin)]
public class WhatsAppAdminController(
    WhatsAppOptions options,
    IWhatsAppSender sender,
    WhatsAppDeliveryTracker tracker) : ControllerBase
{
    [HttpGet("status")]
    public IActionResult Status() => Ok(new
    {
        provider = sender.ProviderName,
        apiVersion = options.ApiVersion,
        phoneNumberId = Tail(options.PhoneNumberId),
        businessAccountId = Tail(options.BusinessAccountId),
        accessTokenSet = !string.IsNullOrWhiteSpace(options.AccessToken),
        appSecretSet = !string.IsNullOrWhiteSpace(options.AppSecret),
        webhookVerifyTokenSet = !string.IsNullOrWhiteSpace(options.WebhookVerifyToken),
        readyToSend = sender.ProviderName == WhatsAppOptions.CloudApiProvider &&
                      !string.IsNullOrWhiteSpace(options.PhoneNumberId) && !string.IsNullOrWhiteSpace(options.AccessToken),
        webhookReady = !string.IsNullOrWhiteSpace(options.AppSecret) && !string.IsNullOrWhiteSpace(options.WebhookVerifyToken),
    });

    public record TestMessageRequest(string? To, string? Template, string? Language, string? Text);

    // Default: Meta's pre-approved "hello_world" template (en_US), which may start a conversation.
    // With Text instead, a plain message - Meta only delivers that within 24 hours of the person
    // messaging the business number.
    [HttpPost("test-message")]
    [EnableRateLimiting("expensive")]
    public async Task<IActionResult> SendTest(TestMessageRequest request, CancellationToken ct)
    {
        var to = WhatsAppPhone.Normalize(request.To, options.DefaultCountryCode);
        if (to is null)
        {
            return BadRequest(new { message = "Enter the number in international format, e.g. 919876543210." });
        }

        var useText = !string.IsNullOrWhiteSpace(request.Text);
        var template = useText ? null : new WhatsAppTemplate(
            string.IsNullOrWhiteSpace(request.Template) ? "hello_world" : request.Template.Trim(), [],
            string.IsNullOrWhiteSpace(request.Language) ? "en_US" : request.Language.Trim());
        var result = await sender.SendAsync(to, useText ? request.Text!.Trim() : "Graffy Studio Management test message", ct, template);

        return Ok(new
        {
            provider = sender.ProviderName,
            to = WhatsAppPhone.Mask(to),
            success = result.Success,
            simulated = result.Simulated,
            messageId = result.MessageId,
            error = result.Error,
            errorCode = result.ErrorCode,
        });
    }

    // Receipts Meta has sent to the webhook for one message since the API started.
    [HttpGet("messages/{messageId}")]
    public IActionResult Receipts(string messageId) => Ok(tracker.Get(messageId));

    private static string? Tail(string value) => string.IsNullOrWhiteSpace(value) ? null : WhatsAppPhone.Mask(value.Trim());
}
