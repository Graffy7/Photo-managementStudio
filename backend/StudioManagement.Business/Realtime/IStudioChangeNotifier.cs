namespace StudioManagement.Business.Realtime;

// Tells a studio's other signed-in devices that some of its data changed, so they re-load it.
// Only area names travel (e.g. "payments") - never the data itself; each device fetches the new
// data through the normal, authorised API. Implemented in the API layer with SignalR.
public interface IStudioChangeNotifier
{
    // excludeConnectionId: the device that made the change (it already refreshed itself).
    Task PublishAsync(int studioId, IReadOnlyCollection<string> areas, string? excludeConnectionId = null);
}

// Area names shared with the frontend (src/realtime/areas.ts).
public static class ChangeAreas
{
    public const string Customers = "customers";
    public const string Events = "events";
    public const string Payments = "payments";
    public const string Quotations = "quotations";
    public const string Workers = "workers";
    public const string Leads = "leads";
    public const string Expenses = "expenses";
    public const string Services = "services";
    public const string Photos = "photos";
    public const string Settings = "settings";
    public const string Notifications = "notifications";
    public const string Subscription = "subscription";
    public const string Modules = "modules";
}
