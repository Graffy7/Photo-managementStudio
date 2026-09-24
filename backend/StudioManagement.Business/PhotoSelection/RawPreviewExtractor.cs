using System.Buffers.Binary;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;

namespace StudioManagement.Business.PhotoSelection;

// Camera RAW files can't be decoded directly, but every camera stores a finished JPEG inside the
// RAW (what the camera's own screen shows - full size on Canon CR2/CR3, Nikon NEF, Fujifilm RAF,
// DNG and most others). The customer preview is made from the largest one. The RAW file itself is
// only ever read.
public static class RawPreviewExtractor
{
    private const int ScanBufferSize = 1 << 20;

    // Where the largest embedded JPEG starts, and the photo's orientation (1-8, EXIF meaning) taken
    // from the RAW's own metadata. Null when the file holds no JPEG we can read.
    public static async Task<(long Offset, ushort Orientation)?> FindAsync(string path, CancellationToken ct)
    {
        await using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);

        long best = -1;
        long bestArea = 0;
        foreach (var offset in await FindJpegStartsAsync(file, ct))
        {
            try
            {
                file.Position = offset;
                var info = await Image.IdentifyAsync(new OffsetStream(file, offset), ct);
                var area = (long)info.Width * info.Height;
                if (info.Metadata.DecodedImageFormat is JpegFormat && area > bestArea)
                {
                    best = offset;
                    bestArea = area;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Not a real JPEG (random bytes that happened to look like a start marker, or the
                // lossless sensor data some cameras also wrap in JPEG markers).
            }
        }

        return best < 0 ? null : (best, await ReadOrientationAsync(file, ct));
    }

    // A read-only view of the file that starts at the embedded JPEG.
    public static Stream OpenAt(string path, long offset)
    {
        var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        return new OffsetStream(file, offset, ownsInner: true);
    }

    // Every FF D8 FF (JPEG start of image) in the file.
    private static async Task<List<long>> FindJpegStartsAsync(FileStream file, CancellationToken ct)
    {
        var starts = new List<long>();
        var buffer = new byte[ScanBufferSize + 2];
        long position = 0;
        var carry = 0;
        file.Position = 0;

        while (true)
        {
            var read = await file.ReadAsync(buffer.AsMemory(carry, ScanBufferSize), ct);
            if (read == 0)
            {
                break;
            }

            var length = carry + read;
            if (length < 3)
            {
                break;
            }

            for (var i = 0; i + 2 < length; i++)
            {
                if (buffer[i] == 0xFF && buffer[i + 1] == 0xD8 && buffer[i + 2] == 0xFF)
                {
                    starts.Add(position - carry + i);
                }
            }

            // Keep the last two bytes so a marker split across reads is still found.
            buffer[0] = buffer[length - 2];
            buffer[1] = buffer[length - 1];
            position += read;
            carry = 2;
        }

        return starts;
    }

    // Orientation tag (0x0112) of the RAW's first TIFF directory. TIFF-based RAWs (CR2, NEF, ARW,
    // DNG, ORF, RW2, PEF, SRW) start with it; CR3 keeps it in its "CMT1" box. 1 = as shot.
    private static async Task<ushort> ReadOrientationAsync(FileStream file, CancellationToken ct)
    {
        try
        {
            var head = new byte[128 * 1024];
            file.Position = 0;
            var length = await file.ReadAtLeastAsync(head, head.Length, throwOnEndOfStream: false, ct);
            var data = head.AsMemory(0, length);

            var cmt = data.Span.IndexOf("CMT1"u8);
            var tiff = IsTiffHeader(data.Span) ? 0 : cmt >= 0 ? cmt + 4 : -1;
            if (tiff < 0 || tiff + 8 > length || !IsTiffHeader(data.Span[tiff..]))
            {
                return 1;
            }

            var little = head[tiff] == (byte)'I';
            ushort U16(int at) => little ? BinaryPrimitives.ReadUInt16LittleEndian(data.Span[at..]) : BinaryPrimitives.ReadUInt16BigEndian(data.Span[at..]);
            uint U32(int at) => little ? BinaryPrimitives.ReadUInt32LittleEndian(data.Span[at..]) : BinaryPrimitives.ReadUInt32BigEndian(data.Span[at..]);

            var ifd = tiff + (int)U32(tiff + 4);
            if (ifd < tiff || ifd + 2 > length)
            {
                return 1;
            }

            var count = U16(ifd);
            for (var i = 0; i < count; i++)
            {
                var entry = ifd + 2 + i * 12;
                if (entry + 12 > length)
                {
                    break;
                }
                if (U16(entry) == 0x0112)
                {
                    var value = U16(entry + 8);
                    return value is >= 1 and <= 8 ? value : (ushort)1;
                }
            }
        }
        catch (Exception ex) when (ex is IOException or ArgumentOutOfRangeException)
        {
        }

        return 1;
    }

    // "II*\0" / "MM\0*", plus the Olympus ("IIRO") and Panasonic ("IIU\0") variants.
    private static bool IsTiffHeader(ReadOnlySpan<byte> d) =>
        d.Length >= 4 &&
        ((d[0] == 'I' && d[1] == 'I' && (d[2] == 42 || d[2] == 'R' || d[2] == 'U')) ||
         (d[0] == 'M' && d[1] == 'M' && d[2] == 0 && d[3] == 42));

    // Presents the inner stream from `start` onwards as if it began there.
    private sealed class OffsetStream(Stream inner, long start, bool ownsInner = false) : Stream
    {
        private long position;

        public override bool CanRead => true;
        public override bool CanSeek => true;
        public override bool CanWrite => false;
        public override long Length => inner.Length - start;

        public override long Position
        {
            get => position;
            set => position = Math.Clamp(value, 0, Length);
        }

        public override int Read(byte[] buffer, int offset, int count) => Read(buffer.AsSpan(offset, count));

        public override int Read(Span<byte> buffer)
        {
            inner.Position = start + position;
            var read = inner.Read(buffer);
            position += read;
            return read;
        }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default)
        {
            inner.Position = start + position;
            var read = await inner.ReadAsync(buffer, ct);
            position += read;
            return read;
        }

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct) =>
            ReadAsync(buffer.AsMemory(offset, count), ct).AsTask();

        public override long Seek(long offset, SeekOrigin origin)
        {
            Position = origin switch
            {
                SeekOrigin.Begin => offset,
                SeekOrigin.Current => position + offset,
                _ => Length + offset
            };
            return position;
        }

        public override void Flush() { }
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            if (disposing && ownsInner)
            {
                inner.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
