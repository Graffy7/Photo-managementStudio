using StudioManagement.Business.PhotoSelection;

namespace StudioManagement.API.BackgroundServices;

// Turns the studio's folder of originals into web previews without holding up the request that
// started the import. Jobs arrive through the in-memory queue; anything a stopped app left
// unfinished is re-queued on startup (the job rows themselves are in the database).
public class PhotoImportBackgroundService(
    IPhotoImportQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<PhotoImportBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            using (var scope = scopeFactory.CreateScope())
            {
                var pending = await scope.ServiceProvider.GetRequiredService<IPhotoImportService>()
                    .ResumeInterruptedJobsAsync(stoppingToken);
                foreach (var jobId in pending)
                {
                    await queue.EnqueueAsync(jobId, stoppingToken);
                }
            }

            await foreach (var jobId in queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<IPhotoImportService>().ProcessJobAsync(jobId, stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Photo import job {JobId} crashed", jobId);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Photo import worker stopped unexpectedly");
        }
    }
}
