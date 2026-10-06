using System.Text.RegularExpressions;

namespace StudioManagement.API.Infrastructure;

// Keeps secrets out of log lines built from URLs. A customer's gallery link is a bearer token in the
// path (/api/public/photo-selection/{token}/...): anyone reading the logs could open that gallery.
public static partial class LogSanitizer
{
    public static string Path(PathString path) => Path(path.Value);

    public static string Path(string? path) =>
        string.IsNullOrEmpty(path) ? "" : GalleryToken().Replace(path, "$1***");

    // The path with ids replaced, so "the same error on a different record" counts as the same error.
    public static string Route(string path) => Digits().Replace(path, "{id}");

    [GeneratedRegex(@"(/photo-selection/)[^/?]+", RegexOptions.IgnoreCase)]
    private static partial Regex GalleryToken();

    [GeneratedRegex(@"\d+")]
    private static partial Regex Digits();
}
