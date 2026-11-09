using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.API.Realtime;
using StudioManagement.Business.WhatsApp;

namespace StudioManagement.API.Controllers;

// Meta calls this (the "Callback URL" in the app's WhatsApp > Configuration page):
//  GET  - once, when the webhook is saved: echo hub.challenge if hub.verify_token matches ours.
//  POST - delivery receipts (sent / delivered / read / failed) and messages people send to the number.
// Every POST must carry Meta's X-Hub-Signature-256 made with the app secret; anything else is refused
// before the body is read as JSON.
[ApiController]
[Route("api/webhooks/whatsapp")]
[AllowAnonymous]
public class WhatsAppWebhookController(
    WhatsAppOptions options,
    WhatsAppDeliveryTracker tracker,
    ILogger<WhatsAppWebhookController> logger) : ControllerBase
{
    [HttpGet]
    public IActionResult Verify(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? token,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        if (!WhatsAppWebhook.IsValidSubscription(mode, token, options.WebhookVerifyToken) || string.IsNullOrEmpty(challenge))
        {
            logger.LogWarning("WhatsApp webhook verification refused (wrong or missing verify token)");
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        logger.LogInformation("WhatsApp webhook verified by Meta");
        return Content(challenge, "text/plain");
    }

    [HttpPost]
    [SkipRealtime]
    [RequestSizeLimit(1024 * 1024)]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, ct);
        var body = buffer.ToArray();

        if (!WhatsAppWebhook.IsValidSignature(body, Request.Headers["X-Hub-Signature-256"].ToString(), options.AppSecret))
        {
            logger.LogWarning("WhatsApp webhook call refused: missing or invalid signature");
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        WhatsAppWebhookPayload payload;
        try
        {
            payload = WhatsAppWebhook.Parse(body);
        }
        catch (System.Text.Json.JsonException)
        {
            return BadRequest();
        }

        foreach (var s in payload.Statuses)
        {
            tracker.Record(s);
            if (s.Status == "failed")
            {
                logger.LogWarning("WhatsApp message {MessageId} to {Phone} FAILED: {Code} {Title}", s.MessageId, s.RecipientMasked, s.ErrorCode, s.ErrorTitle);
            }
            else
            {
                logger.LogInformation("WhatsApp message {MessageId} to {Phone}: {Status}", s.MessageId, s.RecipientMasked, s.Status);
            }
        }
        foreach (var m in payload.Messages)
        {
            logger.LogInformation("WhatsApp message received from {Phone} ({Type})", m.FromMasked, m.Type);
        }

        // 200 quickly, or Meta retries the same call.
        return Ok();
    }
}
