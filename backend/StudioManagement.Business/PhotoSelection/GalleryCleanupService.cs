using StudioManagement.Business.Audit;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public interface IGalleryCleanupService
{
    // Deletes the preview/thumbnail files of galleries whose link has expired and was sent more than
    // PreviewRetentionDays ago. Returns how many galleries were cleaned.
    Task<int> CleanupExpiredAsync(DateTime now, CancellationToken ct = default);
}

// Storage-cost control. Only the small generated previews are ever removed: the customer's
// selections stay in the database (the owner can still export them) and the original photos are
// never touched — this service has no path to them.
public class GalleryCleanupService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    IFileStorage fileStorage,
    IAuditService auditService,
    IUnitOfWork unitOfWork,
    PhotoGalleryOptions options) : IGalleryCleanupService
{
    public async Task<int> CleanupExpiredAsync(DateTime now, CancellationToken ct = default)
    {
        var expired = await galleryRepository.GetExpiredForCleanupAsync(now, now.AddDays(-Math.Max(0, options.PreviewRetentionDays)), ct);
        var cleaned = 0;

        foreach (var gallery in expired)
        {
            ct.ThrowIfCancellationRequested();

            var photos = await photoRepository.GetWithPreviewsAsync(gallery.PhotoGalleryId, ct);
            foreach (var photo in photos)
            {
                if (photo.ThumbnailPath is not null)
                {
                    fileStorage.Delete(photo.ThumbnailPath);
                    photo.ThumbnailPath = null;
                }
                if (photo.PreviewPath is not null)
                {
                    fileStorage.Delete(photo.PreviewPath);
                    photo.PreviewPath = null;
                }
            }

            await unitOfWork.SaveChangesAsync(ct);
            await galleryRepository.MarkPreviewsPurgedAsync(gallery.PhotoGalleryId, now, ct);
            await auditService.LogAsync($"Photo previews removed for expired gallery of event {gallery.EventId}", "PhotoSelection", gallery.StudioId, ct);
            cleaned++;
        }

        return cleaned;
    }
}
