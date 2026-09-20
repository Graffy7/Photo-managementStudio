using System.Threading.Channels;

namespace StudioManagement.Business.PhotoSelection;

// Hands import job ids from the request that created them to the background worker. In-memory on
// purpose: jobs are persisted in PhotoImportJobs, so anything queued when the app stops is
// re-enqueued on the next start (see IPhotoImportService.ResumeInterruptedJobsAsync).
public interface IPhotoImportQueue
{
    ValueTask EnqueueAsync(int jobId, CancellationToken ct = default);
    IAsyncEnumerable<int> ReadAllAsync(CancellationToken ct);
}

public class PhotoImportQueue : IPhotoImportQueue
{
    private readonly Channel<int> _channel = Channel.CreateUnbounded<int>(new UnboundedChannelOptions { SingleReader = true });

    public ValueTask EnqueueAsync(int jobId, CancellationToken ct = default) => _channel.Writer.WriteAsync(jobId, ct);

    public IAsyncEnumerable<int> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}
