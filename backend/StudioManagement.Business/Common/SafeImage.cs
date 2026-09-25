using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Processing;

namespace StudioManagement.Business.Common;

// Turns an uploaded file into a clean image we produced ourselves, or refuses it. The file's name,
// extension and declared content type are never trusted: the bytes must decode as a real JPEG or
// PNG, and what gets stored is a fresh re-encode (so anything hidden in the original - scripts,
// polyglot payloads, metadata - is dropped) with an extension the server picks.
public static class SafeImage
{
    public sealed record Result(MemoryStream Content, string Extension);

    private const int MaxPixels = 40_000_000;       // guards against "decompression bomb" images
    private const int MaxSide = 12_000;

    public static async Task<(Result? Image, string? Error)> ReencodeAsync(Stream upload, long maxBytes, int maxDimension, CancellationToken ct = default)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await upload.ReadAsync(chunk, ct)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > maxBytes)
            {
                return (null, $"The image must be {maxBytes / (1024 * 1024)}MB or smaller.");
            }
        }

        var bytes = buffer.ToArray();
        var isJpeg = bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        var isPng = bytes.Length > 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });
        if (!isJpeg && !isPng)
        {
            return (null, "Only JPG or PNG images can be uploaded.");
        }

        try
        {
            var options = new DecoderOptions { MaxFrames = 1 };
            var info = Image.Identify(options, bytes);
            if (info.Width <= 0 || info.Height <= 0 || info.Width > MaxSide || info.Height > MaxSide || (long)info.Width * info.Height > MaxPixels)
            {
                return (null, "That image is too large in size. Use one under 12,000 pixels on each side.");
            }
            var format = info.Metadata.DecodedImageFormat;
            if (format is not JpegFormat && format is not PngFormat)
            {
                return (null, "Only JPG or PNG images can be uploaded.");
            }

            using var image = Image.Load(options, bytes);
            image.Mutate(x => x.AutoOrient());
            if (image.Width > maxDimension || image.Height > maxDimension)
            {
                image.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(maxDimension, maxDimension) }));
            }
            // Nothing from the original file's metadata is carried over.
            image.Metadata.ExifProfile = null;
            image.Metadata.IptcProfile = null;
            image.Metadata.XmpProfile = null;

            var output = new MemoryStream();
            if (format is PngFormat)
            {
                await image.SaveAsPngAsync(output, new PngEncoder { SkipMetadata = true }, ct);
                output.Position = 0;
                return (new Result(output, ".png"), null);
            }
            await image.SaveAsJpegAsync(output, new JpegEncoder { Quality = 90, SkipMetadata = true }, ct);
            output.Position = 0;
            return (new Result(output, ".jpg"), null);
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException or ImageFormatException)
        {
            return (null, "That file isn't a valid JPG or PNG image.");
        }
    }
}
