using StudioManagement.Business.Notifications;
using StudioManagement.Business.WhatsApp;

namespace StudioManagement.API.BackgroundServices;

// Sweeps every active studio every 15 minutes: creates the in-app reminder notification for events
// happening the next day (once each), and sends the studio owner the two separate WhatsApp messages
// (Function Details, Payment Details) for each function 24 hours before it starts. Studio owners can
// also force an immediate check via POST /api/notifications/check-event-reminders.
public class EventReminderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<EventReminderBackgroundService> logger) : BackgroundService
{
    // Short enough that the "24 hours before" messages go out within 15 minutes of that mark.
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

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

            // WhatsApp: the two separate owner messages, 24 hours before each function. Independent of the in-app notification above
            // (a problem in one never blocks the other), and it runs on the server's local clock because
            // "tomorrow" and the reminder time are the studio's own day, not UTC.
            try
            {
                using var scope = scopeFactory.CreateScope();
                var whatsAppReminderService = scope.ServiceProvider.GetRequiredService<IWhatsAppReminderService>();
                var result = await whatsAppReminderService.SendDueRemindersForAllStudiosAsync(DateTime.Now, stoppingToken);
                if (result.Sent + result.Failed + result.Skipped > 0)
                {
                    logger.LogInformation("WhatsApp reminders: {Sent} sent, {Failed} failed, {Skipped} skipped", result.Sent, result.Failed, result.Skipped);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "WhatsApp reminder run failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
