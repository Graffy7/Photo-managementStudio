namespace StudioManagement.Business.Audit;

// Turns a User-Agent header into something a person reads at a glance: "Chrome on Windows",
// "Safari on iPhone". Anything unrecognised keeps the parts that were recognised.
public static class DeviceDescription
{
    public static string? From(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return null;
        }

        var ua = userAgent;
        var browser =
            ua.Contains("Edg/", StringComparison.Ordinal) ? "Edge" :
            ua.Contains("OPR/", StringComparison.Ordinal) ? "Opera" :
            ua.Contains("SamsungBrowser", StringComparison.Ordinal) ? "Samsung Internet" :
            ua.Contains("Firefox/", StringComparison.Ordinal) ? "Firefox" :
            ua.Contains("Chrome/", StringComparison.Ordinal) || ua.Contains("CriOS", StringComparison.Ordinal) ? "Chrome" :
            ua.Contains("Safari/", StringComparison.Ordinal) ? "Safari" :
            ua.Contains("okhttp", StringComparison.OrdinalIgnoreCase) || ua.Contains("Expo", StringComparison.Ordinal) ? "Mobile app" :
            null;

        var os =
            ua.Contains("iPhone", StringComparison.Ordinal) ? "iPhone" :
            ua.Contains("iPad", StringComparison.Ordinal) ? "iPad" :
            ua.Contains("Android", StringComparison.Ordinal) ? "Android" :
            ua.Contains("Windows", StringComparison.Ordinal) ? "Windows" :
            ua.Contains("Mac OS X", StringComparison.Ordinal) ? "Mac" :
            ua.Contains("Linux", StringComparison.Ordinal) ? "Linux" :
            null;

        return (browser, os) switch
        {
            (not null, not null) => $"{browser} on {os}",
            (not null, null) => browser,
            (null, not null) => os,
            _ => "Other"
        };
    }
}
