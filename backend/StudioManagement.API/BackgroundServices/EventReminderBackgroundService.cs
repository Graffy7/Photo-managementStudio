using StudioManagement.Business.Notifications;

namespace StudioManagement.API.BackgroundServices;

// Sweeps every active studio hourly for events happening the next day and creates a reminder
// notification for each one not already reminded. Studio owners can also force an immediate
// check via POST /api/notifications/check-event-reminders instead of waiting for the next tick.
public class EventReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<EventReminderBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        do
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var eventReminderService = scope.ServiceProvider.GetRequiredService<IEventReminderService>();
                var created = await eventReminderService.CreateRemindersForAllStudiosAsync(DateTime.UtcNow, stoppingToken);
                if (created > 0)
                {
                    logger.LogInformation("Event reminder sweep created {Count} notification(s)", created);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Event reminder sweep failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
