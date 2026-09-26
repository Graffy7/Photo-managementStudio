using Microsoft.AspNetCore.SignalR;
using StudioManagement.Business.Realtime;

namespace StudioManagement.API.Realtime;

// Sends "these areas changed" to one studio's group only. Failures are logged and swallowed: a
// missed live update just means that device refreshes on its own schedule, the save still stands.
public class SignalRStudioChangeNotifier(IHubContext<StudioHub> hub, ILogger<SignalRStudioChangeNotifier> logger) : IStudioChangeNotifier
{
    public async Task PublishAsync(int studioId, IReadOnlyCollection<string> areas, string? excludeConnectionId = null)
    {
        if (areas.Count == 0)
        {
            return;
        }

        try
        {
            var group = StudioHub.GroupFor(studioId);
            var clients = string.IsNullOrEmpty(excludeConnectionId)
                ? hub.Clients.Group(group)
                : hub.Clients.GroupExcept(group, excludeConnectionId);
            await clients.SendAsync(StudioHub.ChangedMethod, new { areas, at = DateTime.UtcNow });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Live update for studio {StudioId} ({Areas}) wasn't sent.", studioId, string.Join(",", areas));
        }
    }
}
