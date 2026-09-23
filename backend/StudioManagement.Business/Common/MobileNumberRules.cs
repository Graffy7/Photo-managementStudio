using System.Text.RegularExpressions;
using FluentValidation;

namespace StudioManagement.Business.Common;

// Mobile numbers are what the studio actually reaches people on - WhatsApp reminders, photo
// selection links and day-board calls all dial them - so "abc" or "12" must never reach the
// database. The rule stays deliberately permissive: Indian mobiles, numbers written with spaces,
// dashes or brackets, and international numbers with a leading + all pass.
public static partial class MobileNumberRules
{
    [GeneratedRegex(@"^\+?[0-9 ()\-]{7,20}$")]
    private static partial Regex AllowedShape();

    public static bool IsValid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !AllowedShape().IsMatch(value))
        {
            return false;
        }

        var digits = value.Count(char.IsDigit);
        return digits is >= 7 and <= 15;
    }

    public static IRuleBuilderOptions<T, string?> MustBeAMobileNumber<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(IsValid).WithMessage("Enter a valid mobile number (7-15 digits).");
}
