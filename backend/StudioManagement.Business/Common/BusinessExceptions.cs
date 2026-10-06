namespace StudioManagement.Business.Common;

// Expected business outcomes that the API turns into clean 4xx answers (see the API's
// ExceptionHandlingMiddleware) instead of a generic 500.

// A field points at something the studio doesn't have (e.g. another studio's event type) -> 400.
public class InvalidReferenceException(string field, string message) : Exception(message)
{
    public string Field { get; } = field;
}

// The request can't be applied because of the record's current state -> 409.
public class BusinessConflictException(string message, string? code = null) : Exception(message)
{
    public string? Code { get; } = code;
}

// Stable resource names for AppLock, so everything that touches the same thing takes the same lock.
public static class LockNames
{
    // One customer per mobile number within a studio: the last 10 digits, as FindByMobileDigitsAsync matches them.
    public static string CustomerMobile(int studioId, string mobileNumber)
    {
        var digits = new string((mobileNumber ?? "").Where(char.IsDigit).ToArray());
        var key = digits.Length >= 10 ? digits[^10..] : digits;
        return $"customer-mobile:{studioId}:{key}";
    }

    public static string LeadConversion(int studioId, int leadId) => $"lead-convert:{studioId}:{leadId}";

    public static string QuotationNumber(int studioId) => $"quotation-number:{studioId}";
}
