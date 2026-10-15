using Microsoft.Extensions.Logging;
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

    // Which galleries' preview files the rules allow removing as of a moment, and which are kept and
    // why. Reads only - nothing is deleted. galleryId narrows it to one gallery.
    Task<CleanupPlanDto> GetPlanAsync(DateTime asOf, int? galleryId = null, CancellationToken ct = default);

    // Removes the preview files of every gallery in the plan. includeNeverSent=false keeps to the
    // original rule (expired links only). Safe to run again: files already gone are simply skipped.
    Task<CleanupRunDto> RunAsync(DateTime asOf, int? galleryId, bool includeNeverSent, CancellationToken ct = default);
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
    PhotoGalleryOptions options,
    ILogger<GalleryCleanupService> logger) : IGalleryCleanupService
{
    public const string RuleExpiredLink = "ExpiredLink";
    public const string RuleNeverSent = "NeverSent";

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

    public async Task<int> CleanupExpiredAsync(DateTime now, CancellationToken ct = default) =>
        (await RunAsync(now, null, includeNeverSent: false, ct)).GalleriesCleaned;

    public async Task<CleanupPlanDto> GetPlanAsync(DateTime asOf, int? galleryId = null, CancellationToken ct = default)
    {
        var plan = new CleanupPlanDto
        {
            AsOf = asOf,
            LinkRetentionDays = options.PreviewRetentionDays,
            UnsentRetentionDays = Math.Max(0, options.UnsentPreviewRetentionDays),
            UnsentCleanupMode = options.UnsentCleanupMode
        };

        // 1. The original rule: link expired, and sent more than PreviewRetentionDays ago.
        var expired = await galleryRepository.GetExpiredForCleanupAsync(asOf, asOf.AddDays(-Math.Max(0, options.PreviewRetentionDays)), ct);
        foreach (var g in expired.Where(g => galleryId is null || g.PhotoGalleryId == galleryId))
        {
            plan.Eligible.Add(await DescribeAsync(g.PhotoGalleryId, g.StudioId, g.EventId, RuleExpiredLink, g.LinkGeneratedAt,
                $"link sent {g.LinkGeneratedAt:yyyy-MM-dd}, expired {g.ExpiresAt:yyyy-MM-dd}", ct));
        }

        // 2. Never sent: kept while anything has happened in the gallery within UnsentPreviewRetentionDays.
        var cutoff = asOf.AddDays(-plan.UnsentRetentionDays);
        foreach (var g in await galleryRepository.GetUnsentWithPreviewsAsync(galleryId, ct))
        {
            var last = LastActivity(g);
            if (g.ImportInProgress)
            {
                plan.Skipped.Add(new CleanupSkipDto(g.GalleryId, g.StudioId, g.EventId, "An import is running for this gallery."));
            }
            else if (last > cutoff)
            {
                plan.Skipped.Add(new CleanupSkipDto(g.GalleryId, g.StudioId, g.EventId,
                    $"Still being prepared: last activity {last:yyyy-MM-dd HH:mm} UTC; eligible from {last.AddDays(plan.UnsentRetentionDays):yyyy-MM-dd HH:mm} UTC."));
            }
            else
            {
                plan.Eligible.Add(await DescribeAsync(g.GalleryId, g.StudioId, g.EventId, RuleNeverSent, last,
                    $"link never sent; no activity since {last:yyyy-MM-dd}", ct));
            }
        }

        plan.TotalFiles = plan.Eligible.Sum(e => e.Files.Count);
        plan.TotalBytes = plan.Eligible.Sum(e => e.Bytes);
        return plan;
    }

    // Created, changed, photos added, an import run: whichever happened last.
    private static DateTime LastActivity(UnsentGalleryRow g) =>
        new[] { g.CreatedAt, g.UpdatedAt, g.LastJobAt ?? DateTime.MinValue, g.LastPhotoAt ?? DateTime.MinValue }.Max();

    private async Task<CleanupCandidateDto> DescribeAsync(int galleryId, int studioId, int eventId, string rule, DateTime? since, string why, CancellationToken ct)
    {
        var candidate = new CleanupCandidateDto { GalleryId = galleryId, StudioId = studioId, EventId = eventId, Rule = rule, Since = since, Reason = why };
        foreach (var photo in await photoRepository.GetWithPreviewsAsync(galleryId, ct))
        {
            foreach (var key in new[] { photo.PreviewPath, photo.ThumbnailPath })
            {
                if (key is null) continue;
                candidate.Files.Add(key);
                candidate.Bytes += fileStorage.GetSize(key);
            }
        }
        return candidate;
    }

    public async Task<CleanupRunDto> RunAsync(DateTime asOf, int? galleryId, bool includeNeverSent, CancellationToken ct = default)
    {
        var plan = await GetPlanAsync(asOf, galleryId, ct);
        var result = new CleanupRunDto { AsOf = asOf, Skipped = plan.Skipped };
        foreach (var candidate in plan.Eligible.Where(c => includeNeverSent || c.Rule == RuleExpiredLink))
        {
            ct.ThrowIfCancellationRequested();
            // The gallery may have changed since the plan was made (link sent, import started): checked again.
            if (candidate.Rule == RuleNeverSent && !await StillUnsentAndIdleAsync(candidate.GalleryId, asOf.AddDays(-plan.UnsentRetentionDays), ct))
            {
                result.Skipped.Add(new CleanupSkipDto(candidate.GalleryId, candidate.StudioId, candidate.EventId, "Changed since the plan was made (link sent or new activity)."));
                continue;
            }
            await PurgeAsync(candidate, asOf, result, ct);
        }
        return result;
    }

    private async Task<bool> StillUnsentAndIdleAsync(int galleryId, DateTime cutoff, CancellationToken ct)
    {
        var row = (await galleryRepository.GetUnsentWithPreviewsAsync(galleryId, ct)).FirstOrDefault();
        return row is not null && !row.ImportInProgress && LastActivity(row) <= cutoff;
    }

    // Deletes one gallery's preview and thumbnail files. A file that can't be deleted keeps its path in
    // the database (so the next run tries again) and the gallery is not marked cleaned. Selections,
    // photo records and the originals are never touched.
    private async Task PurgeAsync(CleanupCandidateDto candidate, DateTime asOf, CleanupRunDto result, CancellationToken ct)
    {
        var failures = 0;
        long freed = 0;
        var deleted = 0;
        foreach (var photo in await photoRepository.GetWithPreviewsAsync(candidate.GalleryId, ct))
        {
            if (photo.ThumbnailPath is not null)
            {
                if (TryDelete(photo.ThumbnailPath, ref freed, ref deleted, result)) photo.ThumbnailPath = null;
                else failures++;
            }
            if (photo.PreviewPath is not null)
            {
                if (TryDelete(photo.PreviewPath, ref freed, ref deleted, result)) photo.PreviewPath = null;
                else failures++;
            }
        }
        await unitOfWork.SaveChangesAsync(ct);

        result.FilesDeleted += deleted;
        result.BytesFreed += freed;
        if (failures > 0)
        {
            result.GalleriesWithFailures.Add(candidate.GalleryId);
            logger.LogWarning("Photo cleanup: gallery {GalleryId} (studio {StudioId}) kept {Failures} file(s) that couldn't be deleted; the next run tries again",
                candidate.GalleryId, candidate.StudioId, failures);
            return;
        }

        await galleryRepository.MarkPreviewsPurgedAsync(candidate.GalleryId, asOf, ct);
        result.GalleriesCleaned++;
        logger.LogInformation("Photo cleanup ({Rule}): gallery {GalleryId} (studio {StudioId}, event {EventId}): {Files} files, {Bytes} bytes removed",
            candidate.Rule, candidate.GalleryId, candidate.StudioId, candidate.EventId, deleted, freed);
        await auditService.LogAsync(candidate.Rule == RuleExpiredLink
            ? $"Photo previews removed for expired gallery of event {candidate.EventId}"
            : $"Photo previews removed for event {candidate.EventId}: the link was never sent and the gallery was unused for {options.UnsentPreviewRetentionDays} days",
            "PhotoSelection", candidate.StudioId, ct);
    }

    private bool TryDelete(string key, ref long freed, ref int deleted, CleanupRunDto result)
    {
        try
        {
            var size = fileStorage.GetSize(key);
            fileStorage.Delete(key); // a file that is already gone is not an error (safe to rerun)
            freed += size;
            if (size > 0) deleted++;
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Photo cleanup couldn't delete {Key}", key);
            if (result.Failures.Count < 50) result.Failures.Add($"{key}: {ex.Message}");
            return false;
        }
    }
}

public record LegacyLinkChange(int GalleryId, int StudioId, int EventId, DateTime LinkSentAt, DateTime OldExpiresAt, DateTime NewExpiresAt, bool Applied);

public record CleanupSkipDto(int GalleryId, int StudioId, int EventId, string Reason);

public class CleanupCandidateDto
{
    public int GalleryId { get; set; }
    public int StudioId { get; set; }
    public int EventId { get; set; }
    // ExpiredLink or NeverSent.
    public string Rule { get; set; } = null!;
    public string Reason { get; set; } = null!;
    // Link sent (ExpiredLink) or last activity (NeverSent).
    public DateTime? Since { get; set; }
    public List<string> Files { get; set; } = [];
    public long Bytes { get; set; }
}

public class CleanupPlanDto
{
    public DateTime AsOf { get; set; }
    public int LinkRetentionDays { get; set; }
    public int UnsentRetentionDays { get; set; }
    public string UnsentCleanupMode { get; set; } = null!;
    public List<CleanupCandidateDto> Eligible { get; set; } = [];
    public List<CleanupSkipDto> Skipped { get; set; } = [];
    public int TotalFiles { get; set; }
    public long TotalBytes { get; set; }
}

public class CleanupRunDto
{
    public DateTime AsOf { get; set; }
    public int GalleriesCleaned { get; set; }
    public int FilesDeleted { get; set; }
    public long BytesFreed { get; set; }
    public List<int> GalleriesWithFailures { get; set; } = [];
    public List<string> Failures { get; set; } = [];
    public List<CleanupSkipDto> Skipped { get; set; } = [];
}
