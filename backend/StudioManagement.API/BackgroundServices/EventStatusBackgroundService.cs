using StudioManagement.Business.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.API.BackgroundServices;

// Keeps every event's status in line with its date as days pass: Upcoming -> Ongoing on the day ->
// Completed after it (cancelled events are left alone). Runs at startup and then every 10 minutes,
// so the change shows shortly after midnight without anyone editing the event.
public class EventStatusBackgroundService(IServiceScopeFactory scopeFactory, ILogger<EventStatusBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(10));
        try
        {
            do
            {
                await SyncAsync(stoppingToken);
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
        }
    }

    private async Task SyncAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var changed = await scope.ServiceProvider.GetRequiredService<IEventRepository>()
                .SyncStatusesWithDateAsync(BusinessClock.Today, DateTime.UtcNow, ct);
            if (changed > 0)
            {
                logger.LogInformation("Event statuses brought in line with their dates: {Count} changed", changed);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Couldn't update event statuses");
        }
    }
}
