using Microsoft.Extensions.Caching.Memory;
using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Billing;

// What a studio may do right now.
public enum AccessLevel
{
    None,       // suspended / inactive: nothing
    ReadOnly,   // subscription lapsed (or the admin says so): look, don't change
    Full        // everything its enabled modules allow
}

public class StudioAccess
{
    public AccessLevel Level { get; init; }
    public bool HasAccess => Level == AccessLevel.Full;
    public bool CanRead => Level != AccessLevel.None;
    public bool IsTrial { get; init; }
    public DateTime? EndDate { get; init; }

    // Why: Active, Trial, ComplimentaryAccess, Expired, NoSubscription, ReadOnlyByAdmin, Suspended, Inactive.
    public string Reason { get; init; } = "";
}

public interface IStudioAccessService
{
    // Decided on the server with the server's clock - the browser's or phone's date plays no
    // part, so changing it bypasses nothing.
    Task<StudioAccess> GetAsync(int studioId, CancellationToken ct = default);

    // Forget the cached answer (after a payment, trial change, suspension, override...).
    void Invalidate(int studioId);
}

public class StudioAccessService(
    IStudioRepository studioRepository,
    IStudioSubscriptionRepository subscriptionRepository,
    IMemoryCache cache) : IStudioAccessService
{
    // Checked on every studio request, so cached briefly; a subscription that runs out is still
    // noticed the moment it does (the cached end date is compared with the clock each time).
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);
    private static string Key(int studioId) => $"studio-access:{studioId}";

    private sealed record Snapshot(bool Exists, bool Active, bool Blocked, string Mode, bool HasSubscription, bool Cancelled, bool IsTrial, DateTime? EndDate);

    public async Task<StudioAccess> GetAsync(int studioId, CancellationToken ct = default)
    {
        if (!cache.TryGetValue(Key(studioId), out Snapshot? snap) || snap is null)
        {
            snap = await LoadAsync(studioId, ct);
            cache.Set(Key(studioId), snap, CacheFor);
        }

        return Decide(snap, DateTime.UtcNow);
    }

    public void Invalidate(int studioId) => cache.Remove(Key(studioId));

    private static StudioAccess Decide(Snapshot s, DateTime now)
    {
        if (!s.Exists || !s.Active) return new StudioAccess { Level = AccessLevel.None, Reason = "Inactive" };
        if (s.Blocked) return new StudioAccess { Level = AccessLevel.None, Reason = "Suspended" };

        var running = s.HasSubscription && !s.Cancelled && s.EndDate > now;
        var subscriptionReason = !s.HasSubscription ? "NoSubscription" : running ? (s.IsTrial ? "Trial" : "Active") : "Expired";

        return s.Mode switch
        {
            StudioAccessModes.Full => new StudioAccess { Level = AccessLevel.Full, IsTrial = s.IsTrial, EndDate = s.EndDate, Reason = running ? subscriptionReason : "ComplimentaryAccess" },
            StudioAccessModes.ReadOnly => new StudioAccess { Level = AccessLevel.ReadOnly, IsTrial = s.IsTrial, EndDate = s.EndDate, Reason = "ReadOnlyByAdmin" },
            // Automatic: a running subscription or trial gives full access; otherwise the studio can
            // still sign in and see everything, but can't change anything. Nothing is ever deleted.
            _ => new StudioAccess { Level = running ? AccessLevel.Full : AccessLevel.ReadOnly, IsTrial = s.IsTrial, EndDate = s.EndDate, Reason = subscriptionReason }
        };
    }

    private async Task<Snapshot> LoadAsync(int studioId, CancellationToken ct)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return new Snapshot(false, false, false, StudioAccessModes.Auto, false, false, false, null);
        }

        var current = await subscriptionRepository.GetCurrentAsync(studioId, ct);
        return new Snapshot(true, studio.IsActive, studio.IsBlocked, studio.AccessMode, current is not null,
            current?.Status == SubscriptionStatuses.Cancelled, current?.IsTrial ?? false, current?.EndDate);
    }
}
