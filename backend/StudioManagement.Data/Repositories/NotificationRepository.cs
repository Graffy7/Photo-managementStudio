using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class NotificationRepository(AppDbContext context) : INotificationRepository
{
    public async Task<(List<Notification> Items, int TotalCount)> SearchAsync(int studioId, bool? isRead, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Notifications.AsNoTracking().Where(n => n.StudioId == studioId);

        if (isRead is not null)
        {
            query = query.Where(n => n.IsRead == isRead);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<int> CountUnreadAsync(int studioId, CancellationToken ct = default) =>
        context.Notifications.CountAsync(n => n.StudioId == studioId && !n.IsRead, ct);

    public Task<Notification?> GetByIdAsync(int studioId, int notificationId, CancellationToken ct = default) =>
        context.Notifications.FirstOrDefaultAsync(n => n.StudioId == studioId && n.NotificationId == notificationId, ct);

    public Task<bool> ReminderExistsAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var marker = $"(Event #{eventId})";
        return context.Notifications.AnyAsync(
            n => n.StudioId == studioId && n.NotificationType == NotificationTypes.EventReminder && n.Message.EndsWith(marker), ct);
    }

    public async Task AddAsync(Notification notification, CancellationToken ct = default) =>
        await context.Notifications.AddAsync(notification, ct);

    public void Update(Notification notification) => context.Notifications.Update(notification);

    public Task<int> MarkAllAsReadAsync(int studioId, CancellationToken ct = default) =>
        context.Notifications
            .Where(n => n.StudioId == studioId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
}
