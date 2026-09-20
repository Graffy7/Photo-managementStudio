using StudioManagement.Business.PhotoSelection;

namespace StudioManagement.API.BackgroundServices;

// Runs "Create/Sync Selected Photos" (copying the chosen originals into Customer Selection) without
// holding up the request that started it. Same queue + resume-on-start pattern as the import worker:
// jobs arrive through the in-memory queue, and anything a stopped app left unfinished is re-queued
// on startup (the job rows themselves live in the database).
public class PhotoCopyBackgroundService(
    IPhotoCopyQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<PhotoCopyBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            using (var scope = scopeFactory.CreateScope())
            {
                var pending = await scope.ServiceProvider.GetRequiredService<IPhotoSelectionCopyService>()
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
                    await scope.ServiceProvider.GetRequiredService<IPhotoSelectionCopyService>().ProcessJobAsync(jobId, stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Selected-photos job {JobId} crashed", jobId);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Selected-photos worker stopped unexpectedly");
        }
    }
}
