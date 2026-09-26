namespace StudioManagement.Business.Sms;

// Sends a one-time verification code by SMS. Providers get the code itself (not a finished
// message) because in India SMS must use a DLT-registered template - MSG91 fills the code into
// that template; Twilio composes the text. Implementations live in the API layer and read their
// keys from configuration (user-secrets / environment), never from code.
public interface ISmsSender
{
    // phoneNumber as stored (e.g. "9876543210" or "+91 98765 43210"); providers normalise it.
    Task SendVerificationCodeAsync(string phoneNumber, string code, int expiryMinutes, CancellationToken ct = default);
}
