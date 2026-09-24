using StudioManagement.API.Infrastructure;
using StudioManagement.Data.Repositories;

namespace StudioManagement.API.BackgroundServices;

// Saves the studio activity counted by UsageTracker once a minute, and once more on shutdown.
public class UsageFlushBackgroundService(UsageTracker tracker, IServiceScopeFactory scopeFactory, ILogger<UsageFlushBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await FlushAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
        }

        await FlushAsync(CancellationToken.None);
    }

    private async Task FlushAsync(CancellationToken ct)
    {
        var increments = tracker.Drain();
        if (increments.Count == 0)
        {
            return;
        }

        try
        {
            using var scope = scopeFactory.CreateScope();
            await scope.ServiceProvider.GetRequiredService<IStudioUsageRepository>().AddAsync(increments, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Couldn't save studio usage");
        }
    }
}
