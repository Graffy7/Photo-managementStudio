namespace StudioManagement.Business.Sms;

// Sends a text message. Plug a provider (MSG91, Twilio, AWS SNS, ...) in by implementing this and
// registering it in Program.cs for its Sms:Provider value; its keys go in configuration
// (user-secrets / environment), never in code.
public interface ISmsSender
{
    // phoneNumber as stored (e.g. "9876543210" or "+91 98765 43210"); providers normalise it.
    Task SendAsync(string phoneNumber, string message, CancellationToken ct = default);
}
