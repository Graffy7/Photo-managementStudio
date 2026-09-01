using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Notifications;

public class EventReminderService(
    IEventRepository eventRepository,
    INotificationRepository notificationRepository,
    IStudioRepository studioRepository,
    INotificationService notificationService) : IEventReminderService
{
    public async Task<int> CreateRemindersForStudioAsync(int studioId, DateTime referenceNow, CancellationToken ct = default)
    {
        var tomorrowStart = referenceNow.Date.AddDays(1);
        var tomorrowEnd = tomorrowStart.AddDays(1);

        var events = await eventRepository.GetForDayAsync(studioId, tomorrowStart, tomorrowEnd, ct);
        if (events.Count == 0)
        {
            return 0;
        }

        var created = 0;
        // Sequential: these share one scoped DbContext, which EF Core does not allow to run
        // concurrent operations against.
        foreach (var @event in events)
        {
            if (await notificationRepository.ReminderExistsAsync(studioId, @event.EventId, ct))
            {
                continue;
            }

            var venueText = string.IsNullOrWhiteSpace(@event.Venue) ? "the venue" : @event.Venue;
            var title = "Event tomorrow";
            var message = $"Reminder: {@event.Customer.FullName}'s event at {venueText} is tomorrow. (Event #{@event.EventId})";

            await notificationService.NotifyAsync(studioId, title, message, NotificationTypes.EventReminder, ct);
            created++;
        }

        return created;
    }

    public async Task<int> CreateRemindersForAllStudiosAsync(DateTime referenceNow, CancellationToken ct = default)
    {
        var studioIds = await studioRepository.GetActiveStudioIdsAsync(ct);

        var total = 0;
        foreach (var studioId in studioIds)
        {
            total += await CreateRemindersForStudioAsync(studioId, referenceNow, ct);
        }

        return total;
    }
}
