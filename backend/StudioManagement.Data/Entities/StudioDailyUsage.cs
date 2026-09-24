namespace StudioManagement.Data.Entities;

// How much a studio used the app on one calendar day (UTC): active minutes are counted from the
// studio's own API requests, so the platform admin can see daily/weekly/monthly usage.
public class StudioDailyUsage
{
    public int StudioId { get; set; }
    public DateTime UsageDate { get; set; }
    public int ActiveMinutes { get; set; }
    public int RequestCount { get; set; }
    public DateTime LastSeenAt { get; set; }

    public Studio Studio { get; set; } = null!;
}
