using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoGalleryRepository(AppDbContext context) : IPhotoGalleryRepository
{
    public Task<PhotoGallery?> GetByIdAsync(int studioId, int galleryId, CancellationToken ct = default) =>
        context.PhotoGalleries
            .AsNoTracking()
            .Include(g => g.Studio)
            .Include(g => g.Customer)
            .Include(g => g.Event).ThenInclude(e => e.EventType)
            .FirstOrDefaultAsync(g => g.StudioId == studioId && g.PhotoGalleryId == galleryId, ct);

    public Task<PhotoGallery?> GetByEventIdAsync(int studioId, int eventId, CancellationToken ct = default) =>
        context.PhotoGalleries
            .AsNoTracking()
            .Include(g => g.Customer)
            .Include(g => g.Event).ThenInclude(e => e.EventType)
            .FirstOrDefaultAsync(g => g.StudioId == studioId && g.EventId == eventId, ct);

    public async Task<(List<Event> Items, int TotalCount)> GetCompletedEventsAsync(int studioId, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Events
            .AsNoTracking()
            .Where(e => e.StudioId == studioId && e.EventStatus == EventStatuses.Completed);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(e => e.Customer.FullName.Contains(term) || (e.Venue != null && e.Venue.Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Include(e => e.Customer)
            .Include(e => e.EventType)
            .OrderByDescending(e => e.EventDate)
            .ThenByDescending(e => e.EventId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<List<PhotoGallery>> GetByEventIdsAsync(int studioId, List<int> eventIds, CancellationToken ct = default)
    {
        if (eventIds.Count == 0)
        {
            return Task.FromResult(new List<PhotoGallery>());
        }

        return context.PhotoGalleries
            .AsNoTracking()
            .Where(g => g.StudioId == studioId && eventIds.Contains(g.EventId))
            .ToListAsync(ct);
    }

    public Task<PhotoGallery?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        context.PhotoGalleries
            .AsNoTracking()
            .Include(g => g.Studio)
            .Include(g => g.Customer)
            .Include(g => g.Event).ThenInclude(e => e.EventType)
            .FirstOrDefaultAsync(g => g.TokenHash == tokenHash, ct);

    public Task<PhotoGallery?> GetByIdUnscopedAsync(int galleryId, CancellationToken ct = default) =>
        context.PhotoGalleries
            .AsNoTracking()
            .Include(g => g.Studio)
            .Include(g => g.Customer)
            .Include(g => g.Event).ThenInclude(e => e.EventType)
            .FirstOrDefaultAsync(g => g.PhotoGalleryId == galleryId, ct);

    public Task MarkFoldersBackfilledAsync(int galleryId, DateTime when, CancellationToken ct = default) =>
        context.PhotoGalleries
            .Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.FoldersBackfilledAt, when), ct);

    public async Task<GallerySelectionCounts> GetCountsAsync(int galleryId, CancellationToken ct = default)
    {
        var total = await context.Photos.CountAsync(p => p.PhotoGalleryId == galleryId && p.IsActive, ct);
        var byType = await context.PhotoSelections
            .Where(s => s.PhotoGalleryId == galleryId)
            .GroupBy(s => s.SelectionType)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return new GallerySelectionCounts(
            total,
            byType.FirstOrDefault(x => x.Type == SelectionTypes.Normal)?.Count ?? 0,
            byType.FirstOrDefault(x => x.Type == SelectionTypes.Big)?.Count ?? 0);
    }

    public async Task<Dictionary<int, GallerySelectionCounts>> GetCountsForGalleriesAsync(List<int> galleryIds, CancellationToken ct = default)
    {
        if (galleryIds.Count == 0)
        {
            return [];
        }

        var totals = await context.Photos
            .Where(p => galleryIds.Contains(p.PhotoGalleryId) && p.IsActive)
            .GroupBy(p => p.PhotoGalleryId)
            .Select(g => new { GalleryId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var selections = await context.PhotoSelections
            .Where(s => galleryIds.Contains(s.PhotoGalleryId))
            .GroupBy(s => new { s.PhotoGalleryId, s.SelectionType })
            .Select(g => new { g.Key.PhotoGalleryId, g.Key.SelectionType, Count = g.Count() })
            .ToListAsync(ct);

        return galleryIds.ToDictionary(
            id => id,
            id => new GallerySelectionCounts(
                totals.FirstOrDefault(t => t.GalleryId == id)?.Count ?? 0,
                selections.FirstOrDefault(s => s.PhotoGalleryId == id && s.SelectionType == SelectionTypes.Normal)?.Count ?? 0,
                selections.FirstOrDefault(s => s.PhotoGalleryId == id && s.SelectionType == SelectionTypes.Big)?.Count ?? 0));
    }

    public Task<List<PhotoGallery>> GetExpiredForCleanupAsync(DateTime now, DateTime sentBefore, CancellationToken ct = default) =>
        context.PhotoGalleries
            .AsNoTracking()
            .Where(g => g.ExpiresAt != null && g.ExpiresAt < now
                        && g.LinkGeneratedAt != null && g.LinkGeneratedAt < sentBefore
                        && g.PreviewsPurgedAt == null)
            .ToListAsync(ct);

    public async Task AddAsync(PhotoGallery gallery, CancellationToken ct = default) =>
        await context.PhotoGalleries.AddAsync(gallery, ct);

    public Task SetSourceFolderAsync(int galleryId, string sourceFolder, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.SourceFolder, sourceFolder).SetProperty(g => g.UpdatedAt, now), ct);

    public Task SetLinkAsync(int galleryId, string tokenHash, string tokenProtected, DateTime? expiresAt, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(g => g.TokenHash, tokenHash)
                .SetProperty(g => g.TokenProtected, tokenProtected)
                .SetProperty(g => g.ExpiresAt, expiresAt)
                .SetProperty(g => g.IsLinkActive, true)
                .SetProperty(g => g.LinkGeneratedAt, now)
                .SetProperty(g => g.UpdatedAt, now), ct);

    public Task RevokeLinkAsync(int galleryId, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(g => g.IsLinkActive, false)
                .SetProperty(g => g.TokenHash, (string?)null)
                .SetProperty(g => g.TokenProtected, (string?)null)
                .SetProperty(g => g.UpdatedAt, now), ct);

    public Task SetStatusAsync(int galleryId, string status, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.Status, status).SetProperty(g => g.UpdatedAt, now), ct);

    public Task MarkFirstOpenedAsync(int galleryId, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId && g.FirstOpenedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.FirstOpenedAt, now), ct);

    public Task MarkSelectionChangedAsync(int galleryId, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.LastSelectionAt, now), ct);

    public async Task<bool> MarkSubmittedAsync(int galleryId, DateTime now, CancellationToken ct = default) =>
        await context.PhotoGalleries
            .Where(g => g.PhotoGalleryId == galleryId
                        && (g.SubmittedAt == null || (g.LastSelectionAt != null && g.LastSelectionAt > g.SubmittedAt)))
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.SubmittedAt, now).SetProperty(g => g.UpdatedAt, now), ct) > 0;

    public Task SetSourceFolderOrNullAsync(int galleryId, string? sourceFolder, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.SourceFolder, sourceFolder).SetProperty(g => g.UpdatedAt, now), ct);

    public Task MarkPreviewsPurgedAsync(int galleryId, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.PreviewsPurgedAt, now).SetProperty(g => g.UpdatedAt, now), ct);

    public Task ResetForPreviewRebuildAsync(int galleryId, DateTime now, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(g => g.PreviewsPurgedAt, (DateTime?)null)
                .SetProperty(g => g.IsLinkActive, false)
                .SetProperty(g => g.TokenHash, (string?)null)
                .SetProperty(g => g.TokenProtected, (string?)null)
                .SetProperty(g => g.ExpiresAt, (DateTime?)null)
                .SetProperty(g => g.UpdatedAt, now), ct);

    public Task MarkSelectionSyncedAsync(int galleryId, DateTime syncedAt, CancellationToken ct = default) =>
        context.PhotoGalleries.Where(g => g.PhotoGalleryId == galleryId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(g => g.SelectionCreatedAt, g => g.SelectionCreatedAt ?? syncedAt)
                .SetProperty(g => g.SelectionSyncedAt, syncedAt), ct);

    public Task<PhotoImportJob?> GetJobByIdAsync(int jobId, CancellationToken ct = default) =>
        context.PhotoImportJobs.AsNoTracking().FirstOrDefaultAsync(j => j.PhotoImportJobId == jobId, ct);

    public Task<PhotoImportJob?> GetJobAsync(int galleryId, int jobId, CancellationToken ct = default) =>
        context.PhotoImportJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.PhotoGalleryId == galleryId && j.PhotoImportJobId == jobId, ct);

    public Task<List<PhotoImportJob>> GetUnfinishedJobsAsync(CancellationToken ct = default) =>
        context.PhotoImportJobs
            .AsNoTracking()
            .Where(j => j.Status == ImportJobStatuses.Queued || j.Status == ImportJobStatuses.Running)
            .OrderBy(j => j.CreatedAt)
            .ToListAsync(ct);

    public Task<PhotoImportJob?> GetLatestJobAsync(int galleryId, CancellationToken ct = default) =>
        context.PhotoImportJobs
            .AsNoTracking()
            .Where(j => j.PhotoGalleryId == galleryId)
            .OrderByDescending(j => j.CreatedAt)
            .FirstOrDefaultAsync(ct);

    public async Task AddJobAsync(PhotoImportJob job, CancellationToken ct = default) =>
        await context.PhotoImportJobs.AddAsync(job, ct);

    public void UpdateJob(PhotoImportJob job) => context.PhotoImportJobs.Update(job);
}
