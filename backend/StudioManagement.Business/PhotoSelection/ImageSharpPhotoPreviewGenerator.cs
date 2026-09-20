using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;
using StudioManagement.Business.Storage;

namespace StudioManagement.Business.PhotoSelection;

public class ImageSharpPhotoPreviewGenerator(IFileStorage fileStorage) : IPhotoPreviewGenerator
{
    // Grid thumbnails are small and cheap; the preview is only fetched when a photo is opened.
    private const int ThumbnailMaxDimension = 400;
    private const int PreviewMaxDimension = 1600;
    private const int ThumbnailQuality = 72;
    private const int PreviewQuality = 75;

    public async Task<GeneratedPreview> GenerateAsync(string sourcePath, int galleryId, CancellationToken ct = default)
    {
        // TargetSize lets the JPEG decoder skip work by decoding at a reduced scale — the difference
        // between seconds and a fraction of a second per 24MP original.
        var decoderOptions = new DecoderOptions { TargetSize = new Size(PreviewMaxDimension, PreviewMaxDimension) };

        await using var source = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        using var image = await Image.LoadAsync(decoderOptions, source, ct);

        image.Mutate(x => x.AutoOrient());
        if (image.Width > PreviewMaxDimension || image.Height > PreviewMaxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(PreviewMaxDimension, PreviewMaxDimension) }));
        }

        var width = image.Width;
        var height = image.Height;
        var folder = $"photo-gallery/{galleryId}";

        var previewUrl = await SaveWebpAsync(image, PreviewQuality, folder, ct);

        using var thumbnail = image.Clone(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(ThumbnailMaxDimension, ThumbnailMaxDimension) }));
        var thumbnailUrl = await SaveWebpAsync(thumbnail, ThumbnailQuality, folder, ct);

        return new GeneratedPreview(thumbnailUrl, previewUrl, width, height);
    }

    private async Task<string> SaveWebpAsync(Image image, int quality, string folder, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        // SkipMetadata strips EXIF (GPS, camera serial…) — nothing about the shoot leaks through a preview.
        await image.SaveAsync(buffer, new WebpEncoder { Quality = quality, FileFormat = WebpFileFormatType.Lossy, SkipMetadata = true }, ct);
        buffer.Position = 0;
        return await fileStorage.SaveAsync(buffer, "photo.webp", folder, ct);
    }
}
