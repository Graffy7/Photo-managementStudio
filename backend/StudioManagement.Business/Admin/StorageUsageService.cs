using Microsoft.Extensions.Caching.Memory;
using StudioManagement.Business.PhotoSelection;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Admin;

public interface IStorageUsageService
{
    // Storage per studio (only studios with photos appear), measured from the files on disk.
    Task<(IReadOnlyDictionary<int, StudioStorageDto> ByStudio, DateTime MeasuredAt)> GetAllAsync(bool refresh = false, CancellationToken ct = default);

    // The full platform report (Super Admin → Storage): every studio, every stored file, cost.
    Task<StorageReportDto> GetReportAsync(bool refresh = false, CancellationToken ct = default);
}

// Measures what the photo module really stores, from the files themselves:
//  * the app's own WebP previews and thumbnails (the only photo files the app writes), listed from the
//    storage provider once and matched to the photo records - so files no record points to show up too;
//  * the originals, which the app never stores: read in place from the studio's photo folder on the
//    server (measured on disk), or kept on the studio's own computer (size as the browser reported it).
// Measuring touches every file, so the result is kept for a few minutes.
public class StorageUsageService(
    IAdminConsoleRepository repository,
    IPhotoGalleryRepository galleryRepository,
    IStudioRepository studioRepository,
    IFileStorage fileStorage,
    PhotoGalleryOptions galleryOptions,
    StorageReportOptions reportOptions,
    IMemoryCache cache) : IStorageUsageService
{
    private const string CacheKey = "admin-storage-report";
    private const string GalleryArea = "photo-gallery";
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(10);

    public async Task<(IReadOnlyDictionary<int, StudioStorageDto> ByStudio, DateTime MeasuredAt)> GetAllAsync(bool refresh = false, CancellationToken ct = default)
    {
        var report = await GetReportAsync(refresh, ct);
        return (report.Studios.ToDictionary(s => s.StudioId), report.MeasuredAt);
    }

    public async Task<StorageReportDto> GetReportAsync(bool refresh = false, CancellationToken ct = default)
    {
        if (!refresh && cache.TryGetValue(CacheKey, out StorageReportDto? cached) && cached is not null)
        {
            return cached;
        }
        var report = await MeasureAsync(ct);
        cache.Set(CacheKey, report, CacheFor);
        return report;
    }

    private async Task<StorageReportDto> MeasureAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // 1. Every file the app stores, as the storage provider reports it.
        var stored = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        var byArea = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        await foreach (var file in fileStorage.ListAsync("", ct))
        {
            stored[file.Key] = file.Size;
            var area = file.Key.Contains('/') ? file.Key[..file.Key.IndexOf('/')] : "(top level)";
            byArea[area] = byArea.GetValueOrDefault(area) + file.Size;
        }

        // 2. Galleries and photos.
        var galleries = (await galleryRepository.GetStorageGalleriesAsync(ct)).ToDictionary(g => g.GalleryId);
        var photos = await repository.GetPhotoFilesAsync(null, ct);
        var studios = new Dictionary<int, StudioStorageDto>();
        StudioStorageDto For(int studioId) =>
            studios.TryGetValue(studioId, out var s) ? s : studios[studioId] = new StudioStorageDto { StudioId = studioId, StudioName = "" };

        var referenced = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var previewBytesByGallery = new Dictionary<int, long>();
        var countedOriginals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var photo in photos)
        {
            ct.ThrowIfCancellationRequested();
            var s = For(photo.StudioId);
            s.PhotoCount++;
            long here = 0;
            foreach (var key in new[] { photo.PreviewPath, photo.ThumbnailPath })
            {
                if (key is null) continue;
                referenced.Add(key);
                if (stored.TryGetValue(key, out var size)) here += size;
                else s.MissingPreviewFiles++;
            }
            if (photo.PreviewPath is not null && stored.TryGetValue(photo.PreviewPath, out var p)) s.PreviewBytes += p;
            if (photo.ThumbnailPath is not null && stored.TryGetValue(photo.ThumbnailPath, out var t)) s.ThumbnailBytes += t;
            if (here > 0)
            {
                s.PhotosWithPreviews++;
                previewBytesByGallery[photo.GalleryId] = previewBytesByGallery.GetValueOrDefault(photo.GalleryId) + here;
            }

            // The same original in two galleries is still one file.
            if (!countedOriginals.Add($"{photo.StudioId}|{photo.OriginalFolder}|{photo.RelativePath}")) continue;
            if (DevicePhotoService.IsDeviceSource(photo.OriginalFolder))
            {
                // On the studio's computer: never on the server; the browser reported its size.
                if (photo.FileSize is > 0) { s.OriginalsOnComputerBytes += photo.FileSize.Value; s.OriginalsOnComputerCount++; }
                else s.MissingOriginals++;
            }
            else if (OriginalSize(photo) is { } size)
            {
                s.OriginalsOnServerBytes += size;
                s.OriginalsOnServerCount++;
            }
            else
            {
                s.MissingOriginals++;
            }
        }

        // 3. Gallery state: what is still kept, what cleanup will remove, what it never will.
        var cleanupSentBefore = now.AddDays(-Math.Max(0, galleryOptions.PreviewRetentionDays));
        foreach (var g in galleries.Values)
        {
            var s = For(g.StudioId);
            s.GalleryCount++;
            var bytes = previewBytesByGallery.GetValueOrDefault(g.GalleryId);
            if (bytes == 0) continue;
            s.ActiveGalleryCount++;
            // Same rule as GalleryCleanupService.CleanupExpiredAsync.
            if (g.ExpiresAt < now && g.LinkGeneratedAt < cleanupSentBefore && g.PreviewsPurgedAt == null)
            {
                s.AwaitingCleanupBytes += bytes;
                s.AwaitingCleanupGalleries++;
            }
            else if (g.LinkGeneratedAt == null)
            {
                s.NeverSentBytes += bytes;
                s.NeverSentGalleries++;
            }
        }

        // 4. Files in gallery folders that no photo record points to.
        long unassignedBytes = 0;
        var unassignedFiles = 0;
        foreach (var (key, size) in stored)
        {
            if (!key.StartsWith(GalleryArea + "/", StringComparison.OrdinalIgnoreCase) || referenced.Contains(key)) continue;
            var parts = key.Split('/');
            if (parts.Length >= 3 && int.TryParse(parts[1], out var galleryId) && galleries.TryGetValue(galleryId, out var owner))
            {
                var s = For(owner.StudioId);
                s.OrphanBytes += size;
                s.OrphanFiles++;
            }
            else
            {
                unassignedBytes += size;
                unassignedFiles++;
            }
        }

        foreach (var s in studios.Values)
        {
            s.OriginalBytes = s.OriginalsOnServerBytes + s.OriginalsOnComputerBytes;
        }
        var names = (await studioRepository.GetByIdsAsync(studios.Keys, ct)).ToDictionary(x => x.StudioId, x => x.StudioName);
        foreach (var s in studios.Values)
        {
            s.StudioName = names.GetValueOrDefault(s.StudioId) ?? $"Studio {s.StudioId}";
        }

        var total = stored.Values.Sum();
        return new StorageReportDto
        {
            MeasuredAt = now,
            Studios = studios.Values.OrderByDescending(s => s.AppBytes + s.OrphanBytes).ThenBy(s => s.StudioName).ToList(),
            StoredBytesByArea = byArea.OrderByDescending(a => a.Value).ToDictionary(a => a.Key, a => a.Value),
            TotalStoredBytes = total,
            TotalStoredFiles = stored.Count,
            UnassignedOrphanBytes = unassignedBytes,
            UnassignedOrphanFiles = unassignedFiles,
            PricePerGbMonth = reportOptions.PricePerGbMonth,
            Currency = string.IsNullOrWhiteSpace(reportOptions.Currency) ? "INR" : reportOptions.Currency,
            // Decimal GB (10^9 bytes), which is how storage providers bill.
            EstimatedMonthlyCost = Math.Round(total / 1_000_000_000m * reportOptions.PricePerGbMonth, 2),
            PreviewMaxDimension = galleryOptions.PreviewMaxDimension,
            PreviewQuality = galleryOptions.PreviewQuality,
            ThumbnailMaxDimension = galleryOptions.ThumbnailMaxDimension,
            ThumbnailQuality = galleryOptions.ThumbnailQuality,
            PreviewRetentionDays = galleryOptions.PreviewRetentionDays
        };
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
