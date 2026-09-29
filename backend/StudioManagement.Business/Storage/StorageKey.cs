namespace StudioManagement.Business.Storage;

// A storage key is a relative, forward-slash path inside the storage ("logos/3/ab12.png").
public static class StorageKey
{
    // Rows written before keys existed hold "/uploads/<key>" (the old public web path).
    private const string LegacyPrefix = "/uploads/";

    // The clean key, or null when the value can't be a key we issued: empty, absolute, a drive or
    // UNC path, "..", or characters outside [A-Za-z0-9._-/]. Our keys are folder names we choose plus
    // random file names, so this never rejects a real one.
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        var key = value.Trim().Replace('\\', '/');
        if (key.StartsWith(LegacyPrefix, StringComparison.OrdinalIgnoreCase))
        {
            key = key[LegacyPrefix.Length..];
        }
        key = key.TrimStart('/');

        if (key.Length is 0 or > 300 || key.Contains("//") || key.Contains(':'))
        {
            return null;
        }
        foreach (var segment in key.Split('/'))
        {
            if (segment is "" or "." or ".." || !segment.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_'))
            {
                return null;
            }
        }
        return key;
    }
}
