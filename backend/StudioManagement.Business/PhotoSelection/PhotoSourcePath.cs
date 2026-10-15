namespace StudioManagement.Business.PhotoSelection;

// One canonical form for "where an original photo lives", so the same file is recognised however its
// folder was typed ("G:\Shoot\", "g:\shoot", "G:\Shoot\.\Candid\..") and a folder inside an imported
// folder is recognised too. Two files are the same photo only when their full paths match - never
// because their file names do.
public static class PhotoSourcePath
{
    // Windows paths ignore case; Linux paths don't.
    public static StringComparer Comparer { get; } = OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
    public static StringComparison Comparison { get; } = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    // Full, normalised path of a folder (no trailing separator), or null if it isn't a usable path.
    public static string? Folder(string? folder)
    {
        if (string.IsNullOrWhiteSpace(folder) || DevicePhotoService.IsDeviceSource(folder))
        {
            return null;
        }
        try
        {
            return Trim(Path.GetFullPath(folder));
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return null;
        }
    }

    // Full, normalised path of one original, or null (photos from a studio's computer have none).
    public static string? Of(string? folder, string relativePath)
    {
        var root = Folder(folder);
        if (root is null)
        {
            return null;
        }
        try
        {
            return Trim(Path.GetFullPath(Path.Combine(root, relativePath.Replace('\\', Path.DirectorySeparatorChar).Replace('/', Path.DirectorySeparatorChar))));
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return null;
        }
    }

    // True when the two folders are the same folder or one contains the other.
    public static bool Overlaps(string? a, string? b)
    {
        var x = Folder(a);
        var y = Folder(b);
        return x is not null && y is not null && (IsSameOrUnder(x, y) || IsSameOrUnder(y, x));
    }

    private static bool IsSameOrUnder(string path, string folder) =>
        path.Equals(folder, Comparison) || path.StartsWith(folder + Path.DirectorySeparatorChar, Comparison);

    // "C:\" keeps its separator; everything else loses a trailing one.
    private static string Trim(string full) =>
        full.Length > 3 ? full.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) : full;
}
