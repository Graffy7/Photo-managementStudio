namespace StudioManagement.Business.Common;

// Personal details in log lines: enough to recognise whose request it was, not the full address/number.
public static class LogMask
{
    // "priya@example.com" -> "p***@example.com"
    public static string Email(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return "";
        }
        var at = email.IndexOf('@');
        return at <= 0 ? "***" : $"{email[0]}***{email[at..]}";
    }

    // "+91 98765 43210" -> "******3210"
    public static string Phone(string? phone)
    {
        var digits = new string((phone ?? "").Where(char.IsDigit).ToArray());
        return digits.Length <= 4 ? "***" : new string('*', 6) + digits[^4..];
    }
}
