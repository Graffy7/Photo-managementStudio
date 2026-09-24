namespace StudioManagement.Business.PhotoSelection;

// Bound from the "PhotoGallery" configuration section (all optional).
public class PhotoGalleryOptions
{
    // When set, owners may only import from folders under one of these roots. Empty = unrestricted,
    // which matches today's single-machine deployment (the backend runs on the studio's own PC).
    public string[] AllowedImportRoots { get; set; } = [];

    // Size/quality of the small copies the customer looks at (WebP). The 1600px preview is what the
    // customer zooms, pans and selects on; the original is never sent. Applies to newly imported
    // (or rebuilt) photos only.
    public int PreviewMaxDimension { get; set; } = 1600;
    public int PreviewQuality { get; set; } = 70;
    public int ThumbnailMaxDimension { get; set; } = 360;
    public int ThumbnailQuality { get; set; } = 65;

    // How many days after a link is sent the preview files are kept. Once this has passed (and the
    // link has expired) cleanup deletes them; the owner rebuilds them from the originals to send a
    // new link.
    public int PreviewRetentionDays { get; set; } = 10;

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
