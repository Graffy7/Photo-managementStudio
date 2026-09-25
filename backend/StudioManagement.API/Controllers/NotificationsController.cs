using StudioManagement.API.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Notifications;
using StudioManagement.Business.Tenant;
using StudioManagement.Business.WhatsApp;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Notifications)]
public class NotificationsController(
    INotificationService notificationService,
    IEventReminderService eventReminderService,
    IWhatsAppReminderService whatsAppReminderService,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] bool? isRead, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await notificationService.SearchAsync(StudioId, isRead, page, pageSize, ct));

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount(CancellationToken ct) =>
        Ok(new { count = await notificationService.GetUnreadCountAsync(StudioId, ct) });

    [AllowWhenReadOnly]
    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkAsRead(int id, CancellationToken ct)
    {
        var notification = await notificationService.MarkAsReadAsync(StudioId, id, ct);
        return notification is null ? NotFound() : Ok(notification);
    }

    [AllowWhenReadOnly]
    [HttpPost("mark-all-read")]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken ct) =>
        Ok(new { updated = await notificationService.MarkAllAsReadAsync(StudioId, ct) });

    // Reminders normally arrive via the hourly background sweep; this lets the studio owner force
    // an immediate re-check (e.g. right after adding tomorrow's event) without waiting for it.
    [HttpPost("check-event-reminders")]
    public async Task<IActionResult> CheckEventReminders(CancellationToken ct) =>
        Ok(new { created = await eventReminderService.CreateRemindersForStudioAsync(StudioId, DateTime.UtcNow, ct) });

    // "Test Event Reminder": builds the two day-before WhatsApp messages and shows them separately, marked
    // TEST, with who would receive each. Nothing is sent unless sendToOwner is set — and then only to the
    // owner's own phone. Pass eventId to preview a specific event as if it were tomorrow.
    [FeatureRequired(FeatureCodes.WhatsApp)]
    [HttpPost("whatsapp-reminders/test")]
    public async Task<IActionResult> TestWhatsAppReminder(TestReminderRequestDto request, CancellationToken ct)
    {
        var preview = await whatsAppReminderService.PreviewAsync(StudioId, DateTime.Now, request, ct);
        return preview is null ? NotFound(new { message = "That event wasn't found." }) : Ok(preview);
    }

    // Send today's due WhatsApp reminders now, without waiting for the reminder time. Reminders already
    // sent are never repeated.
    [FeatureRequired(FeatureCodes.WhatsApp)]
    [HttpPost("whatsapp-reminders/send-now")]
    public async Task<IActionResult> SendWhatsAppRemindersNow(CancellationToken ct) =>
        Ok(await whatsAppReminderService.SendRemindersForStudioAsync(StudioId, DateTime.Now, ignoreTime: true, ct));
}
