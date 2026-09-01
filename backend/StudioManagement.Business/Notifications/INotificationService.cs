using StudioManagement.Business.Common;

namespace StudioManagement.Business.Notifications;

public interface INotificationService
{
    Task<PagedResult<NotificationDto>> SearchAsync(int studioId, bool? isRead, int page, int pageSize, CancellationToken ct = default);
    Task<int> GetUnreadCountAsync(int studioId, CancellationToken ct = default);
    Task<NotificationDto?> MarkAsReadAsync(int studioId, int notificationId, CancellationToken ct = default);
    Task<int> MarkAllAsReadAsync(int studioId, CancellationToken ct = default);

    /// Fire-and-forget style creator used by other services when something notification-worthy
    /// happens — mirrors IAuditService.LogAsync's pattern of an immediate, independent save.
    Task NotifyAsync(int studioId, string title, string message, string notificationType, CancellationToken ct = default);
}
