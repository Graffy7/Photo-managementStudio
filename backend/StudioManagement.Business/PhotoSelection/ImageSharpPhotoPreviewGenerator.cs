using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;
using StudioManagement.Business.Storage;

namespace StudioManagement.Business.PhotoSelection;

public class ImageSharpPhotoPreviewGenerator(IFileStorage fileStorage, PhotoGalleryOptions options) : IPhotoPreviewGenerator
{
    public async Task<GeneratedPreview> GenerateAsync(string sourcePath, int galleryId, CancellationToken ct = default)
    {
        await using var source = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);

        // TargetSize lets the JPEG decoder skip work by decoding at a reduced scale — the difference
        // between seconds and a fraction of a second per 24MP original. But it resizes TO the target,
        // upscaling anything smaller (a 280px image would be stored as a blurry 1280px one), so it is
        // only used when the original is actually larger than a preview needs to be.
        var info = await Image.IdentifyAsync(source, ct);
        source.Position = 0;
        var needsDownscale = info.Width > options.PreviewMaxDimension || info.Height > options.PreviewMaxDimension;
        var decoderOptions = needsDownscale
            ? new DecoderOptions { TargetSize = new Size(options.PreviewMaxDimension, options.PreviewMaxDimension) }
            : new DecoderOptions();

        using var image = await Image.LoadAsync(decoderOptions, source, ct);

        image.Mutate(x => x.AutoOrient());
        if (image.Width > options.PreviewMaxDimension || image.Height > options.PreviewMaxDimension)
        {
            image.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(options.PreviewMaxDimension, options.PreviewMaxDimension) }));
        }

        var width = image.Width;
        var height = image.Height;
        var folder = $"photo-gallery/{galleryId}";

        var previewUrl = await SaveWebpAsync(image, options.PreviewQuality, folder, ct);

        using var thumbnail = image.Clone(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(options.ThumbnailMaxDimension, options.ThumbnailMaxDimension) }));
        var thumbnailUrl = await SaveWebpAsync(thumbnail, options.ThumbnailQuality, folder, ct);

        return new GeneratedPreview(thumbnailUrl, previewUrl, width, height);
    }

    private async Task<string> SaveWebpAsync(Image image, int quality, string folder, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        // SkipMetadata strips EXIF (GPS, camera serial…) — nothing about the shoot leaks through a preview.
        await image.SaveAsync(buffer, new WebpEncoder { Quality = quality, Method = WebpEncodingMethod.Level6, FileFormat = WebpFileFormatType.Lossy, SkipMetadata = true }, ct);
        buffer.Position = 0;
        return await fileStorage.SaveAsync(buffer, "photo.webp", folder, ct);
    }
}
