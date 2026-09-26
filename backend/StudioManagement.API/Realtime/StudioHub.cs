using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Realtime;

// Live "something changed" channel for a studio's signed-in devices (/hubs/studio).
// Server -> client only: clients can't send anything here. Each connection joins exactly one
// group, its own studio's, taken from the signed-in token's StudioId claim - never from anything
// the client sends - so a device only ever hears about its own studio.
[Authorize(Roles = UserTypes.StudioOwner)]
public class StudioHub : Hub
{
    public const string Path = "/hubs/studio";
    public const string ChangedMethod = "changed";

    public static string GroupFor(int studioId) => $"studio-{studioId}";

    public override async Task OnConnectedAsync()
    {
        if (!int.TryParse(Context.User?.FindFirst(TenantClaimTypes.StudioId)?.Value, out var studioId))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(studioId));
        await base.OnConnectedAsync();
    }
}
