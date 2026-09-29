namespace StudioManagement.Business.PhotoSelection;

// ThumbnailKey / PreviewKey are storage keys (see IFileStorage), not addresses.
public record GeneratedPreview(string ThumbnailKey, string PreviewKey, int Width, int Height);

public interface IPhotoPreviewGenerator
{
    // Reads the original from disk, writes a small thumbnail and a larger preview (both WebP) through
    // IFileStorage, and returns their URLs. The original is only ever read — never moved, changed
    // or copied anywhere.
    Task<GeneratedPreview> GenerateAsync(string sourcePath, int galleryId, CancellationToken ct = default);

    // Same output from an image the studio's browser already made from the original (a downscaled
    // JPEG/WebP): it is decoded, re-encoded and resized here, so nothing the browser sent is stored
    // as-is. Throws for anything that isn't a real image.
    Task<GeneratedPreview> GenerateFromUploadAsync(Stream image, int galleryId, CancellationToken ct = default);
}
