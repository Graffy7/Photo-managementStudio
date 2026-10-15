namespace StudioManagement.Business.PhotoSelection;

// Bound from the "PhotoGallery" configuration section (all optional).
public class PhotoGalleryOptions
{
    // Optional: each studio's photo folder defaults to <StudioRootBase>/<StudioId> (created on first
    // use). The platform admin can instead set a specific folder per studio. A studio with neither
    // can't browse or import anything (see StudioPhotoRootService).
    public string? StudioRootBase { get; set; }

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

    // Galleries whose customer link was never sent: their previews are removed once nothing has
    // happened in the gallery (created, photos added, import run, any change) for this many days.
    public int UnsentPreviewRetentionDays { get; set; } = 10;

    // What the daily job does with those never-sent galleries: "Off", "DryRun" (only logs what it
    // would remove - the default until the dry-run list has been checked) or "Delete".
    public string UnsentCleanupMode { get; set; } = UnsentCleanupModes.DryRun;

    // Test setups only: lets the platform admin run the cleanup "as of" a later date. Never enable in production.
    public bool AllowCleanupClockOverride { get; set; }

    // Country calling code (digits only, e.g. "91") added to 10-digit customer mobile numbers when
    // building WhatsApp links. Empty = numbers are used exactly as stored.
    public string DefaultCountryCode { get; set; } = "";

    // Previews are generated a few at a time — enough to keep a CPU busy without decoding many
    // 25MB originals into memory at once.
    public int ImportParallelism { get; set; } = Math.Clamp(Environment.ProcessorCount / 2, 1, 4);

}

public static class UnsentCleanupModes
{
    public const string Off = "Off";
    public const string DryRun = "DryRun";
    public const string Delete = "Delete";
}
