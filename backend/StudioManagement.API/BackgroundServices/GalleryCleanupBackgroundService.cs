using StudioManagement.Business.PhotoSelection;

namespace StudioManagement.API.BackgroundServices;

// Once a day, deletes the preview files of photo galleries whose customer link expired a while ago.
// Selections are kept and the originals are never touched.
public class GalleryCleanupBackgroundService(IServiceScopeFactory scopeFactory, ILogger<GalleryCleanupBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    // A studio PC that is switched off overnight would never reach a 24h timer, so the first pass
    // runs shortly after startup too.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(StartupDelay, stoppingToken);
        using var timer = new PeriodicTimer(Interval);

        do
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var cleaned = await scope.ServiceProvider.GetRequiredService<IGalleryCleanupService>()
                    .CleanupExpiredAsync(DateTime.UtcNow, stoppingToken);
                if (cleaned > 0)
                {
                    logger.LogInformation("Photo cleanup removed previews for {Count} expired galleries", cleaned);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Photo gallery cleanup failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
