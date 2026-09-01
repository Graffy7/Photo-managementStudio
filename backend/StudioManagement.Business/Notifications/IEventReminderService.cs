namespace StudioManagement.Business.Notifications;

public interface IEventReminderService
{
    /// Creates an EventReminder notification for each of the given studio's events happening the
    /// day after referenceNow, skipping any event that already has one. Returns how many were created.
    Task<int> CreateRemindersForStudioAsync(int studioId, DateTime referenceNow, CancellationToken ct = default);

    /// Sweeps every active studio — this is what the background job calls on each tick.
    Task<int> CreateRemindersForAllStudiosAsync(DateTime referenceNow, CancellationToken ct = default);
}
