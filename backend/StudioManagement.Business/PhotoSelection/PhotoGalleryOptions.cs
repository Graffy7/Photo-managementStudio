namespace StudioManagement.Business.PhotoSelection;

// Bound from the "PhotoGallery" configuration section (all optional).
public class PhotoGalleryOptions
{
    // When set, owners may only import from folders under one of these roots. Empty = unrestricted,
    // which matches today's single-machine deployment (the backend runs on the studio's own PC).
    public string[] AllowedImportRoots { get; set; } = [];

    // How long after a gallery's link expires its preview files are kept before cleanup deletes them.
    public int PreviewPurgeGraceDays { get; set; } = 30;

    // Country calling code (digits only, e.g. "91") added to 10-digit customer mobile numbers when
    // building WhatsApp links. Empty = numbers are used exactly as stored.
    public string DefaultCountryCode { get; set; } = "";

    // Previews are generated a few at a time — enough to keep a CPU busy without decoding many
    // 25MB originals into memory at once.
    public int ImportParallelism { get; set; } = Math.Clamp(Environment.ProcessorCount / 2, 1, 4);
}
