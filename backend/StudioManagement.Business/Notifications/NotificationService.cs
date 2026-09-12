using StudioManagement.Business.Common;
using StudioManagement.Business.Settings;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Notifications;

public class NotificationService(
    INotificationRepository notificationRepository,
    IStudioSettingsService studioSettingsService,
    IUnitOfWork unitOfWork) : INotificationService
{
    public async Task<PagedResult<NotificationDto>> SearchAsync(int studioId, bool? isRead, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await notificationRepository.SearchAsync(studioId, isRead, page, pageSize, ct);
        return new PagedResult<NotificationDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public Task<int> GetUnreadCountAsync(int studioId, CancellationToken ct = default) =>
        notificationRepository.CountUnreadAsync(studioId, ct);

    public async Task<NotificationDto?> MarkAsReadAsync(int studioId, int notificationId, CancellationToken ct = default)
    {
        var notification = await notificationRepository.GetByIdAsync(studioId, notificationId, ct);
        if (notification is null)
        {
            return null;
        }

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notificationRepository.Update(notification);
            await unitOfWork.SaveChangesAsync(ct);
        }

        return MapToDto(notification);
    }

    public Task<int> MarkAllAsReadAsync(int studioId, CancellationToken ct = default) =>
        notificationRepository.MarkAllAsReadAsync(studioId, ct);

    public async Task NotifyAsync(int studioId, string title, string message, string notificationType, CancellationToken ct = default)
    {
        if (!await studioSettingsService.IsNotificationEnabledAsync(studioId, notificationType, ct))
        {
            return;
        }

        var notification = new Notification
        {
            StudioId = studioId,
            Title = title,
            Message = message,
            NotificationType = notificationType,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        await notificationRepository.AddAsync(notification, ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static NotificationDto MapToDto(Notification notification) => new()
    {
        NotificationId = notification.NotificationId,
        Title = notification.Title,
        Message = notification.Message,
        NotificationType = notification.NotificationType,
        IsRead = notification.IsRead,
        CreatedAt = notification.CreatedAt
    };
}
