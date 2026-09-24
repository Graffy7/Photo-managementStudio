using System.Collections.Concurrent;
using StudioManagement.Data.Repositories;

namespace StudioManagement.API.Infrastructure;

// Counts how long each studio actively uses the app, in memory, from its own signed-in requests:
// the time between two requests up to IdleGap apart counts as active; a longer gap starts a new
// stretch worth one minute. UsageFlushBackgroundService saves it once a minute, so a request never
// waits on the database for this.
public class UsageTracker
{
    private static readonly TimeSpan IdleGap = TimeSpan.FromMinutes(5);

    private sealed class Entry
    {
        public double PendingSeconds;
        public int PendingRequests;
        public DateTime LastSeen;
    }

    private readonly ConcurrentDictionary<int, Entry> entries = new();

    public void Record(int studioId, DateTime now)
    {
        var entry = entries.GetOrAdd(studioId, _ => new Entry());
        lock (entry)
        {
            // A new (UTC) day starts its own count.
            var continuing = entry.LastSeen != default && entry.LastSeen.Date == now.Date && now - entry.LastSeen <= IdleGap;
            entry.PendingSeconds += continuing ? Math.Max(0, (now - entry.LastSeen).TotalSeconds) : 60;
            entry.PendingRequests++;
            entry.LastSeen = now;
        }
    }

    // Takes the whole minutes counted so far; the leftover seconds wait for the next flush.
    public List<UsageIncrement> Drain()
    {
        var result = new List<UsageIncrement>();
        foreach (var (studioId, entry) in entries)
        {
            lock (entry)
            {
                if (entry.PendingRequests == 0 && entry.PendingSeconds < 60)
                {
                    continue;
                }

                var minutes = (int)(entry.PendingSeconds / 60);
                entry.PendingSeconds -= minutes * 60;
                result.Add(new UsageIncrement(studioId, entry.LastSeen.Date, minutes, entry.PendingRequests, entry.LastSeen));
                entry.PendingRequests = 0;
            }
        }

        return result;
    }
}
