using Microsoft.Extensions.Caching.Memory;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Admin;

public interface IStorageUsageService
{
    // Storage per studio (only studios with photos appear), measured from the files on disk.
    Task<(IReadOnlyDictionary<int, StudioStorageDto> ByStudio, DateTime MeasuredAt)> GetAllAsync(bool refresh = false, CancellationToken ct = default);
}

// Measures what each studio's photos take up: the originals (read in place from the studio's
// folder, never stored by the app), and the app's own WebP previews and thumbnails. Stat-ing every
// file is cheap but not free, so the result is kept for a few minutes.
public class StorageUsageService(IAdminConsoleRepository repository, IFileStorage fileStorage, IMemoryCache cache) : IStorageUsageService
{
    private const string CacheKey = "admin-storage-usage";
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(10);

    private sealed record Snapshot(Dictionary<int, StudioStorageDto> ByStudio, DateTime MeasuredAt);

    public async Task<(IReadOnlyDictionary<int, StudioStorageDto> ByStudio, DateTime MeasuredAt)> GetAllAsync(bool refresh = false, CancellationToken ct = default)
    {
        if (!refresh && cache.TryGetValue(CacheKey, out Snapshot? cached) && cached is not null)
        {
            return (cached.ByStudio, cached.MeasuredAt);
        }

        var files = await repository.GetPhotoFilesAsync(null, ct);
        var result = new Dictionary<int, StudioStorageDto>();
        var countedOriginals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var file in files)
        {
            ct.ThrowIfCancellationRequested();
            if (!result.TryGetValue(file.StudioId, out var s))
            {
                s = new StudioStorageDto { StudioId = file.StudioId, StudioName = "" };
                result[file.StudioId] = s;
            }

            s.PhotoCount++;
            if (file.PreviewPath is not null) s.PreviewBytes += fileStorage.GetSize(file.PreviewPath);
            if (file.ThumbnailPath is not null) s.ThumbnailBytes += fileStorage.GetSize(file.ThumbnailPath);

            // The same original imported into two galleries is still one file on the studio's disk.
            // (Compared by full path: "G:\Shoot" + "a\1.jpg" and "G:\Shoot\a" + "1.jpg" are one file.)
            var key = $"{file.StudioId}|{FullPath(file)}";
            if (!countedOriginals.Add(key))
            {
                continue;
            }

            var size = OriginalSize(file);
            if (size is null) s.MissingOriginals++;
            else s.OriginalBytes += size.Value;
        }

        var snapshot = new Snapshot(result, DateTime.UtcNow);
        cache.Set(CacheKey, snapshot, CacheFor);
        return (snapshot.ByStudio, snapshot.MeasuredAt);
    }

    private static string FullPath(PhotoFileRef file)
    {
        try
        {
            return string.IsNullOrWhiteSpace(file.OriginalFolder)
                ? file.RelativePath
                : Path.GetFullPath(Path.Combine(file.OriginalFolder, file.RelativePath));
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return $"{file.OriginalFolder}|{file.RelativePath}";
        }
    }

    private static long? OriginalSize(PhotoFileRef file)
    {
        if (string.IsNullOrWhiteSpace(file.OriginalFolder))
        {
            return null;
        }

        try
        {
            var info = new FileInfo(Path.Combine(file.OriginalFolder, file.RelativePath));
            return info.Exists ? info.Length : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return null;
        }
    }
}
