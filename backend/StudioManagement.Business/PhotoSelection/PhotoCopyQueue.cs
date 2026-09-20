using System.Threading.Channels;

namespace StudioManagement.Business.PhotoSelection;

// Hands "create/sync selected photos" job ids to the background worker. In-memory on purpose: the
// jobs are rows in PhotoCopyJobs, so anything queued when the app stops is picked up again on start.
public interface IPhotoCopyQueue
{
    ValueTask EnqueueAsync(int jobId, CancellationToken ct = default);
    IAsyncEnumerable<int> ReadAllAsync(CancellationToken ct);
}

public class PhotoCopyQueue : IPhotoCopyQueue
{
    private readonly Channel<int> _channel = Channel.CreateUnbounded<int>(new UnboundedChannelOptions { SingleReader = true });

    public ValueTask EnqueueAsync(int jobId, CancellationToken ct = default) => _channel.Writer.WriteAsync(jobId, ct);

    public IAsyncEnumerable<int> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}
