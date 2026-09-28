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
    public string ApiBaseUrl { get; set; } = "https://graph.facebook.com";

    // Meta only lets a business START a conversation with an approved message template (free text is
    // delivered only within 24 hours of the person messaging the business). When these names are set
    // the two owner messages are sent as those templates; empty = plain text.
    public string FunctionDetailsTemplate { get; set; } = "";
    public string PaymentDetailsTemplate { get; set; } = "";
    public string TemplateLanguage { get; set; } = "en";

    // Country calling code (digits only, e.g. "91") added to bare 10-digit numbers.
    public string DefaultCountryCode { get; set; } = "";

    // How long before the function starts the two owner messages are sent.
    public int HoursBefore { get; set; } = 24;

    // For a function with no start time: the time on the day before at which the messages go.
    public string ReminderTime { get; set; } = "09:00";

    // A failed delivery is retried by later runs until it has been attempted this many times.
    public int MaxAttempts { get; set; } = 3;

    public TimeSpan ReminderTimeOfDay =>
        TimeSpan.TryParseExact(ReminderTime, @"hh\:mm", CultureInfo.InvariantCulture, out var t) ? t : new TimeSpan(9, 0, 0);
}
