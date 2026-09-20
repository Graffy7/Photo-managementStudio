namespace StudioManagement.Business.PhotoSelection;

// Bound from the "PhotoGallery" configuration section (all optional).
public class PhotoGalleryOptions
{
    // When set, owners may only import from folders under one of these roots. Empty = unrestricted,
    // which matches today's single-machine deployment (the backend runs on the studio's own PC).
    public string[] AllowedImportRoots { get; set; } = [];

    // Size/quality of the small copies the customer looks at (WebP). Measured on real photos, these
    // defaults store roughly 40% less than 1600px/q75 with no visible difference at normal viewing
    // size. Raise them for sharper zooming, lower them to save more disk; applies to newly imported
    // photos only.
    public int PreviewMaxDimension { get; set; } = 1280;
    public int PreviewQuality { get; set; } = 70;
    public int ThumbnailMaxDimension { get; set; } = 360;
    public int ThumbnailQuality { get; set; } = 65;

    // How long after a gallery's link expires its preview files are kept before cleanup deletes them.
    public int PreviewPurgeGraceDays { get; set; } = 30;

    // Country calling code (digits only, e.g. "91") added to 10-digit customer mobile numbers when
    // building WhatsApp links. Empty = numbers are used exactly as stored.
    public string DefaultCountryCode { get; set; } = "";

    // Previews are generated a few at a time — enough to keep a CPU busy without decoding many
    // 25MB originals into memory at once.
    public int ImportParallelism { get; set; } = Math.Clamp(Environment.ProcessorCount / 2, 1, 4);

    // Whether a folder may be read from / written to under the AllowedImportRoots restriction
    // (everything is allowed when no roots are configured).
    public bool IsAllowed(string fullPath)
    {
        if (AllowedImportRoots.Length == 0)
        {
            return true;
        }

        var candidate = Path.GetFullPath(fullPath).TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
        return AllowedImportRoots.Any(root =>
            candidate.StartsWith(Path.GetFullPath(root).TrimEnd('\\', '/') + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
    }
}
