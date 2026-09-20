using System.Text.RegularExpressions;

namespace StudioManagement.Business.WhatsApp;

public static partial class WhatsAppPhone
{
    // Digits only, ready for WhatsApp (international format, no "+"). Bare 10-digit numbers get the
    // configured country code. Null when there's no usable number.
    public static string? Normalize(string? raw, string defaultCountryCode)
    {
        var digits = NonDigits().Replace(raw ?? "", "").TrimStart('0');
        if (digits.Length == 10 && defaultCountryCode.Length > 0)
        {
            digits = defaultCountryCode + digits;
        }

        return digits.Length is >= 8 and <= 15 ? digits : null;
    }

    // ******3210 — enough to recognise a number in a log without printing it.
    public static string Mask(string phone) => phone.Length <= 4 ? "****" : new string('*', phone.Length - 4) + phone[^4..];

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigits();
}
