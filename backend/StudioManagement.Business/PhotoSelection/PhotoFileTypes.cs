namespace StudioManagement.Business.PhotoSelection;

// Which files in a studio folder count as photos. Only JPEG and camera RAW files are imported;
// everything else (videos, PSD/XMP sidecars, PNG exports, documents…) is skipped and reported.
public static class PhotoFileTypes
{
    public static readonly HashSet<string> JpegExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".jpe"
    };

    // Canon, Nikon, Sony, Adobe DNG, Fujifilm, Olympus/OM, Panasonic, Pentax, Samsung.
    public static readonly HashSet<string> RawExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".cr2", ".cr3", ".nef", ".nrw", ".arw", ".sr2", ".srf", ".dng", ".raf", ".orf", ".rw2", ".pef", ".srw"
    };

    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mov", ".avi", ".mkv", ".mts", ".m2ts", ".wmv", ".m4v", ".3gp", ".mpg", ".mpeg", ".webm", ".flv", ".mxf"
    };

    public static bool IsRaw(string path) => RawExtensions.Contains(Path.GetExtension(path));

    public static bool IsPhoto(string path)
    {
        var ext = Path.GetExtension(path);
        return JpegExtensions.Contains(ext) || RawExtensions.Contains(ext);
    }

    public static bool IsVideo(string path) => VideoExtensions.Contains(Path.GetExtension(path));
}
