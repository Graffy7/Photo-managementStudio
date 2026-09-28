using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Audit;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public enum DeviceUploadOutcome { Added, PreviewRebuilt, AlreadyThere, GalleryNotFound, InvalidPath, NotAPhoto, InvalidImage }

public record DeviceSelectionFile(string Source, string RelativePath, string FileName, string SelectionType);

public interface IDevicePhotoService
{
    // Relative paths (inside the chosen folder) that already have previews - the browser skips them.
    Task<List<string>?> GetPresentAsync(int studioId, int galleryId, string folderName, CancellationToken ct = default);

    // One photo, previewed by the studio's own browser from the original on their computer.
    Task<DeviceUploadOutcome> AddAsync(int studioId, int galleryId, string folderName, string relativePath, Stream preview, CancellationToken ct = default);

    // Called once the browser has finished a folder: one audit line for the whole import.
    Task<bool> CompleteAsync(int studioId, int galleryId, string folderName, int added, int skipped, int failed, CancellationToken ct = default);

    // The customer's picks with where they are inside the chosen folder, so the studio's browser can
    // copy the originals into "Customer Selection" on their own computer.
    Task<List<DeviceSelectionFile>?> GetSelectionFilesAsync(int studioId, int galleryId, CancellationToken ct = default);
}

// Photos added from the studio's OWN computer through the browser (the hosted setup): the browser
// opens the computer's folder dialog, makes a screen-size copy of each JPEG/RAW locally and uploads only
// that. The originals never leave the studio's computer. Folders, numbering, customer links and
// selections work exactly as for photos imported from a server folder.
public class DevicePhotoService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    IPhotoFolderRepository folderRepository,
    IPhotoPreviewGenerator previewGenerator,
    IAuditService auditService,
    IUnitOfWork unitOfWork,
    ILogger<DevicePhotoService> logger) : IDevicePhotoService
{
    // Photos from a device are recorded under this "source" instead of a server path.
    public const string SourcePrefix = "This computer › ";

    public static bool IsDeviceSource(string? source) => source?.StartsWith(SourcePrefix, StringComparison.Ordinal) == true;

    // Numbers and new folders are handed out one photo at a time per gallery (uploads arrive in parallel).
    private static readonly ConcurrentDictionary<int, SemaphoreSlim> GalleryLocks = new();

    public static string? SourceFor(string folderName)
    {
        var name = (folderName ?? "").Trim();
        return name.Length is 0 or > 120 || name.IndexOfAny(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) >= 0 || name is "." or ".."
            ? null : SourcePrefix + name;
    }

    // "Candid/IMG_1.JPG" -> "Candid\IMG_1.JPG" (the form server imports use). Null when unsafe.
    private static string? CleanRelative(string relativePath)
    {
        var segments = (relativePath ?? "").Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (segments.Length is 0 or > 12 || segments.Any(s => s is "." or ".." || s.IndexOfAny([':', '*', '?', '"', '<', '>', '|']) >= 0))
        {
            return null;
        }
        var joined = string.Join('\\', segments);
        return joined.Length > 400 ? null : joined;
    }

    public async Task<List<string>?> GetPresentAsync(int studioId, int galleryId, string folderName, CancellationToken ct = default)
    {
        var source = SourceFor(folderName);
        if (source is null || await galleryRepository.GetByIdAsync(studioId, galleryId, ct) is null)
        {
            return null;
        }
        return (await photoRepository.GetBySourceAsync(galleryId, source, includeUnrecorded: false, ct))
            .Where(p => p.PreviewPath is not null)
            .Select(p => p.SourceRelativePath.Replace('\\', '/'))
            .ToList();
    }

    public async Task<DeviceUploadOutcome> AddAsync(int studioId, int galleryId, string folderName, string relativePath, Stream preview, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return DeviceUploadOutcome.GalleryNotFound;
        }
        var source = SourceFor(folderName);
        var relative = CleanRelative(relativePath);
        if (source is null || relative is null)
        {
            return DeviceUploadOutcome.InvalidPath;
        }
        if (!PhotoFileTypes.IsPhoto(relative) || SelectionFolders.IsInsideGenerated(relative))
        {
            return DeviceUploadOutcome.NotAPhoto;
        }

        var existing = (await photoRepository.GetBySourceAsync(galleryId, source, includeUnrecorded: false, ct))
            .FirstOrDefault(p => string.Equals(p.SourceRelativePath, relative, StringComparison.OrdinalIgnoreCase));
        if (existing?.PreviewPath is not null)
        {
            return DeviceUploadOutcome.AlreadyThere;
        }

        GeneratedPreview generated;
        try
        {
            generated = await previewGenerator.GenerateFromUploadAsync(preview, galleryId, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Uploaded preview for {File} in gallery {GalleryId} was not a usable image", relative, galleryId);
            return DeviceUploadOutcome.InvalidImage;
        }

        var gate = GalleryLocks.GetOrAdd(galleryId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            var now = DateTime.UtcNow;
            if (gallery.PreviewsPurgedAt is not null && (await galleryRepository.GetByIdAsync(studioId, galleryId, ct))?.PreviewsPurgedAt is not null)
            {
                // The 10-day cleanup had removed the previews; they are coming back, so a new link will be needed.
                await galleryRepository.ResetForPreviewRebuildAsync(galleryId, now, ct);
            }

            if (existing is not null)
            {
                // Its preview was removed by the cleanup: same photo, same number, same selection.
                var photo = await photoRepository.GetByIdAsync(galleryId, existing.PhotoId, ct);
                if (photo is null)
                {
                    return DeviceUploadOutcome.GalleryNotFound;
                }
                photo.ThumbnailPath = generated.ThumbnailUrl;
                photo.PreviewPath = generated.PreviewUrl;
                photo.Width = generated.Width;
                photo.Height = generated.Height;
                await unitOfWork.SaveChangesAsync(ct);
                return DeviceUploadOutcome.PreviewRebuilt;
            }

            var folderId = await FolderIdForAsync(gallery, relative, ct);
            await photoRepository.AddRangeAsync([new Photo
            {
                PhotoGalleryId = galleryId,
                PhotoNumber = await photoRepository.GetMaxPhotoNumberAsync(galleryId, ct) + 1,
                // Stored paths use '\'; Path.GetFileName only splits on it on Windows.
                FileName = relative[(relative.LastIndexOf('\\') + 1)..],
                SourceFolder = source,
                SourceRelativePath = relative,
                PhotoFolderId = folderId,
                ThumbnailPath = generated.ThumbnailUrl,
                PreviewPath = generated.PreviewUrl,
                Width = generated.Width,
                Height = generated.Height,
                IsActive = true,
                CreatedAt = now
            }], ct);
            await unitOfWork.SaveChangesAsync(ct);
            await galleryRepository.SetSourceFolderAsync(galleryId, source, now, ct);
            return DeviceUploadOutcome.Added;
        }
        finally
        {
            gate.Release();
        }
    }

    // A photo in "Candid Photos\IMG_1.JPG" goes into the delivery folder "Candid Photos" (made if new).
    private async Task<int?> FolderIdForAsync(PhotoGallery gallery, string relative, CancellationToken ct)
    {
        var segments = relative.Split('\\', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length < 2)
        {
            return null;
        }
        var name = segments[0];
        var folders = await folderRepository.GetByGalleryAsync(gallery.PhotoGalleryId, ct);
        var match = folders.FirstOrDefault(f => string.Equals(f.Name, name, StringComparison.OrdinalIgnoreCase));
        if (match is not null)
        {
            return match.PhotoFolderId;
        }

        var now = DateTime.UtcNow;
        var folder = new PhotoFolder
        {
            StudioId = gallery.StudioId,
            PhotoGalleryId = gallery.PhotoGalleryId,
            Name = name.Length > 100 ? name[..100] : name,
            SortOrder = folders.Count == 0 ? 1 : folders.Max(f => f.SortOrder) + 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        await folderRepository.AddAsync(folder, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return folder.PhotoFolderId;
    }

    public async Task<bool> CompleteAsync(int studioId, int galleryId, string folderName, int added, int skipped, int failed, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return false;
        }
        var name = SourceFor(folderName)?[SourcePrefix.Length..] ?? "folder";
        await auditService.LogAsync($"Photos added from this computer: {Math.Max(0, added)} from \"{name}\" (event {gallery.EventId}), {Math.Max(0, skipped)} skipped, {Math.Max(0, failed)} failed",
            "PhotoSelection", studioId, ct);
        return true;
    }

    public async Task<List<DeviceSelectionFile>?> GetSelectionFilesAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        if (await galleryRepository.GetByIdAsync(studioId, galleryId, ct) is null)
        {
            return null;
        }
        return (await photoRepository.GetSelectedAsync(galleryId, ct))
            .Where(s => IsDeviceSource(s.Photo.SourceFolder))
            .Select(s => new DeviceSelectionFile(
                s.Photo.SourceFolder![SourcePrefix.Length..],
                s.Photo.SourceRelativePath.Replace('\\', '/'),
                s.Photo.FileName,
                SelectionFolders.NameFor(s.SelectionType ?? 1)))
            .ToList();
    }
}
