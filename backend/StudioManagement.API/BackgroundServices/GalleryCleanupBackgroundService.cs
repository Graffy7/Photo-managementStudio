using StudioManagement.Business.PhotoSelection;

namespace StudioManagement.API.BackgroundServices;

// Once a day, deletes the preview files of photo galleries whose customer link expired a while ago,
// and handles galleries whose link was never sent according to PhotoGallery:UnsentCleanupMode
// ("DryRun" only logs what would be removed; "Delete" removes it; "Off" skips them).
// Selections are kept and the originals are never touched.
public class GalleryCleanupBackgroundService(
    IServiceScopeFactory scopeFactory,
    PhotoGalleryOptions options,
    ILogger<GalleryCleanupBackgroundService> logger) : BackgroundService
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
                var cleanup = scope.ServiceProvider.GetRequiredService<IGalleryCleanupService>();
                var now = DateTime.UtcNow;
                var deleteUnsent = string.Equals(options.UnsentCleanupMode, UnsentCleanupModes.Delete, StringComparison.OrdinalIgnoreCase);

                var run = await cleanup.RunAsync(now, null, includeNeverSent: deleteUnsent, stoppingToken);
                if (run.GalleriesCleaned > 0 || run.GalleriesWithFailures.Count > 0)
                {
                    logger.LogInformation(
                        "Photo cleanup: {Galleries} galleries cleaned, {Files} files / {Bytes} bytes removed, {Failed} galleries with files that couldn't be deleted",
                        run.GalleriesCleaned, run.FilesDeleted, run.BytesFreed, run.GalleriesWithFailures.Count);
                }

                if (string.Equals(options.UnsentCleanupMode, UnsentCleanupModes.DryRun, StringComparison.OrdinalIgnoreCase))
                {
                    var plan = await cleanup.GetPlanAsync(now, null, stoppingToken);
                    foreach (var g in plan.Eligible.Where(e => e.Rule == GalleryCleanupService.RuleNeverSent))
                    {
                        logger.LogInformation("Photo cleanup DRY RUN: would remove {Files} files ({Bytes} bytes) of never-sent gallery {GalleryId} (studio {StudioId}): {Reason}",
                            g.Files.Count, g.Bytes, g.GalleryId, g.StudioId, g.Reason);
                    }
                    foreach (var skip in plan.Skipped)
                    {
                        logger.LogInformation("Photo cleanup: kept gallery {GalleryId} (studio {StudioId}): {Reason}", skip.GalleryId, skip.StudioId, skip.Reason);
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Photo gallery cleanup failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
