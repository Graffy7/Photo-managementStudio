namespace StudioManagement.Business.PhotoSelection;

public record GeneratedPreview(string ThumbnailUrl, string PreviewUrl, int Width, int Height);

public interface IPhotoPreviewGenerator
{
    // Reads the original from disk, writes a small thumbnail and a larger preview (both WebP) through
    // IFileStorage, and returns their URLs. The original is only ever read — never moved, changed
    // or copied anywhere.
    Task<GeneratedPreview> GenerateAsync(string sourcePath, int galleryId, CancellationToken ct = default);
}
