using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface INotificationRepository
{
    Task<(List<Notification> Items, int TotalCount)> SearchAsync(int studioId, bool? isRead, int page, int pageSize, CancellationToken ct = default);
    Task<int> CountUnreadAsync(int studioId, CancellationToken ct = default);
    Task<Notification?> GetByIdAsync(int studioId, int notificationId, CancellationToken ct = default);
    Task<bool> ReminderExistsAsync(int studioId, int eventId, CancellationToken ct = default);
    Task AddAsync(Notification notification, CancellationToken ct = default);
    void Update(Notification notification);
    Task<int> MarkAllAsReadAsync(int studioId, CancellationToken ct = default);
}
