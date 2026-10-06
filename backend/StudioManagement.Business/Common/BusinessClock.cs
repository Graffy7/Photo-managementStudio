namespace StudioManagement.Business.Common;

// "What day is it" for the studios, in their time zone (App:TimeZone, default India Standard Time) -
// not the server's clock (a VPS usually runs on UTC) and not UTC (which is still "yesterday" in India
// until 05:30). Stored timestamps stay in UTC; only calendar decisions (today, this month, due
// reminders) go through here.
public static class BusinessClock
{
    public static TimeZoneInfo Zone { get; private set; } = Resolve(null);

    public static void Configure(string? timeZoneId) => Zone = Resolve(timeZoneId);

    public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone);

    public static DateTime Today => Now.Date;

    // A calendar day/time in the business time zone -> the matching UTC instant (for comparing with
    // UTC timestamps such as CreatedAt).
    public static DateTime ToUtc(DateTime businessTime) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(businessTime, DateTimeKind.Unspecified), Zone);

    private static TimeZoneInfo Resolve(string? id)
    {
        foreach (var candidate in new[] { id, "India Standard Time", "Asia/Kolkata" })
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(candidate);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }
        return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "India Standard Time", "India Standard Time");
    }
}
