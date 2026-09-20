using System.Globalization;

namespace StudioManagement.Business.WhatsApp;

// Bound from the "WhatsApp" configuration section (all optional).
public class WhatsAppOptions
{
    public const string LogProvider = "Log";
    public const string CloudApiProvider = "CloudApi";

    // "Log" (default): nothing leaves the machine — each message is written to the application log,
    // so the reminder logic can be developed and tested without an account. "CloudApi": messages are
    // sent through the WhatsApp Business Cloud API using the settings below.
    public string Provider { get; set; } = LogProvider;

    public string PhoneNumberId { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public string ApiVersion { get; set; } = "v20.0";

    // Country calling code (digits only, e.g. "91") added to bare 10-digit numbers.
    public string DefaultCountryCode { get; set; } = "";

    // Local time of day (HH:mm) from which tomorrow's reminders are sent. The hourly job sends them on
    // its first run after this time; the delivery log makes sure that happens once per event.
    public string ReminderTime { get; set; } = "18:00";

    // A failed delivery is retried by later runs until it has been attempted this many times.
    public int MaxAttempts { get; set; } = 3;

    public TimeSpan ReminderTimeOfDay =>
        TimeSpan.TryParseExact(ReminderTime, @"hh\:mm", CultureInfo.InvariantCulture, out var t) ? t : new TimeSpan(18, 0, 0);
}
