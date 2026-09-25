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
    Task<List<LegacyLinkChange>> CapLegacyLinksAsync(int? studioId, bool apply, DateTime now, CancellationToken ct = default);
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
    // Links sent before the 5/10-day rule can still run 14 or 30 days. This brings them in line with
    // today's rule (at most MaxLinkDays after sending) without surprising anyone: a link is never cut
    // to less than LegacyLinkGraceDays from now, an expiry is only ever moved earlier, and no photo,
    // preview or selection is touched here - previews go only through the normal cleanup once a link
    // has expired. apply=false only reports what would change.
    public const int MaxLinkDays = 10;
    public const int LegacyLinkGraceDays = 2;

    public async Task<List<LegacyLinkChange>> CapLegacyLinksAsync(int? studioId, bool apply, DateTime now, CancellationToken ct = default)
    {
        var changes = new List<LegacyLinkChange>();
        foreach (var gallery in await galleryRepository.GetLinksLongerThanAsync(studioId, MaxLinkDays, now, ct))
        {
            var capped = gallery.LinkGeneratedAt!.Value.AddDays(MaxLinkDays);
            var floor = now.AddDays(LegacyLinkGraceDays);
            var newExpiry = capped > floor ? capped : floor;
            if (newExpiry >= gallery.ExpiresAt!.Value)
            {
                continue;   // already ends within the grace period - nothing to shorten
            }

            var applied = apply && await galleryRepository.ShortenLinkExpiryAsync(gallery.PhotoGalleryId, newExpiry, now, ct);
            if (applied)
            {
                await auditService.LogAsync(
                    $"Old photo link shortened to the {MaxLinkDays}-day rule (event {gallery.EventId}): ends {newExpiry:yyyy-MM-dd} instead of {gallery.ExpiresAt:yyyy-MM-dd}",
                    "PhotoSelection", gallery.StudioId, ct);
            }
            changes.Add(new LegacyLinkChange(gallery.PhotoGalleryId, gallery.StudioId, gallery.EventId,
                gallery.LinkGeneratedAt.Value, gallery.ExpiresAt.Value, newExpiry, applied));
        }
        return changes;
    }

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

public record LegacyLinkChange(int GalleryId, int StudioId, int EventId, DateTime LinkSentAt, DateTime OldExpiresAt, DateTime NewExpiresAt, bool Applied);
