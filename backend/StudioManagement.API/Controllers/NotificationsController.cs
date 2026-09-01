using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Notifications;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class NotificationsController(
    INotificationService notificationService,
    IEventReminderService eventReminderService,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] bool? isRead, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await notificationService.SearchAsync(StudioId, isRead, page, pageSize, ct));

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount(CancellationToken ct) =>
        Ok(new { count = await notificationService.GetUnreadCountAsync(StudioId, ct) });

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkAsRead(int id, CancellationToken ct)
    {
        var notification = await notificationService.MarkAsReadAsync(StudioId, id, ct);
        return notification is null ? NotFound() : Ok(notification);
    }

    [HttpPost("mark-all-read")]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken ct) =>
        Ok(new { updated = await notificationService.MarkAllAsReadAsync(StudioId, ct) });

    // Reminders normally arrive via the hourly background sweep; this lets the studio owner force
    // an immediate re-check (e.g. right after adding tomorrow's event) without waiting for it.
    [HttpPost("check-event-reminders")]
    public async Task<IActionResult> CheckEventReminders(CancellationToken ct) =>
        Ok(new { created = await eventReminderService.CreateRemindersForStudioAsync(StudioId, DateTime.UtcNow, ct) });
}
