using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoRepository(AppDbContext context) : IPhotoRepository
{
    private IQueryable<Photo> GalleryPhotos(int galleryId) =>
        context.Photos.Where(p => p.PhotoGalleryId == galleryId && p.IsActive);

    private static IQueryable<Photo> ApplyFilter(IQueryable<Photo> query, PhotoFilter filter) => filter switch
    {
        PhotoFilter.Selected => query.Where(p => p.Selection != null),
        PhotoFilter.NotSelected => query.Where(p => p.Selection == null),
        PhotoFilter.Normal => query.Where(p => p.Selection != null && p.Selection.SelectionType == SelectionTypes.Normal),
        PhotoFilter.Big => query.Where(p => p.Selection != null && p.Selection.SelectionType == SelectionTypes.Big),
        _ => query
    };

    private static IQueryable<PhotoWithSelection> Project(IQueryable<Photo> query) =>
        query.Select(p => new PhotoWithSelection
        {
            Photo = p,
            SelectionType = p.Selection == null ? null : p.Selection.SelectionType,
            SelectedAt = p.Selection == null ? null : p.Selection.SelectedAt
        });

    public async Task<(List<PhotoWithSelection> Items, int TotalCount)> GetPageAsync(
        int galleryId, PhotoFilter filter, string? search, int page, int pageSize, int? folderId, CancellationToken ct = default)
    {
        var query = ApplyFilter(GalleryPhotos(galleryId).AsNoTracking(), filter);

        // folderId 0 means the "Other" bucket: everything that was never filed into a folder.
        if (folderId == 0)
        {
            query = query.Where(p => p.PhotoFolderId == null);
        }
        else if (folderId is > 0)
        {
            query = query.Where(p => p.PhotoFolderId == folderId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            // Metadata only: the file name contains the text, or the photo number matches exactly.
            query = int.TryParse(term, out var number)
                ? query.Where(p => p.FileName.Contains(term) || p.PhotoNumber == number)
                : query.Where(p => p.FileName.Contains(term));
        }

        var totalCount = await query.CountAsync(ct);
        var items = await Project(query.OrderBy(p => p.PhotoNumber))
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<Photo?> GetByIdAsync(int galleryId, int photoId, CancellationToken ct = default) =>
        GalleryPhotos(galleryId).AsNoTracking().FirstOrDefaultAsync(p => p.PhotoId == photoId, ct);

    public Task<PhotoWithSelection?> GetWithSelectionAsync(int galleryId, int photoId, CancellationToken ct = default) =>
        Project(GalleryPhotos(galleryId).AsNoTracking().Where(p => p.PhotoId == photoId)).FirstOrDefaultAsync(ct);

    public Task<List<PhotoWithSelection>> GetSelectedAsync(int galleryId, CancellationToken ct = default) =>
        Project(GalleryPhotos(galleryId).AsNoTracking().Where(p => p.Selection != null).OrderBy(p => p.PhotoNumber))
            .ToListAsync(ct);

    public async Task<HashSet<string>> GetImportedPathsAsync(int galleryId, CancellationToken ct = default) =>
        (await context.Photos.AsNoTracking()
            .Where(p => p.PhotoGalleryId == galleryId)
            .Select(p => p.SourceRelativePath)
            .ToListAsync(ct))
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    public async Task<int> GetMaxPhotoNumberAsync(int galleryId, CancellationToken ct = default) =>
        await context.Photos.Where(p => p.PhotoGalleryId == galleryId).MaxAsync(p => (int?)p.PhotoNumber, ct) ?? 0;

    public Task AddRangeAsync(IEnumerable<Photo> photos, CancellationToken ct = default) =>
        context.Photos.AddRangeAsync(photos, ct);

    public Task<List<Photo>> GetWithPreviewsAsync(int galleryId, CancellationToken ct = default) =>
        context.Photos.Where(p => p.PhotoGalleryId == galleryId && (p.PreviewPath != null || p.ThumbnailPath != null)).ToListAsync(ct);

    public Task<List<Photo>> GetWithoutPreviewsAsync(int galleryId, CancellationToken ct = default) =>
        context.Photos.Where(p => p.PhotoGalleryId == galleryId && p.PreviewPath == null).OrderBy(p => p.PhotoNumber).ToListAsync(ct);

    public Task<int> CountWithoutPreviewsAsync(int galleryId, CancellationToken ct = default) =>
        context.Photos.CountAsync(p => p.PhotoGalleryId == galleryId && p.PreviewPath == null, ct);

    public async Task<List<ImportedSourceCounts>> GetSourceCountsAsync(int galleryId, string? fallbackSource, CancellationToken ct = default)
    {
        var rows = await context.Photos.AsNoTracking()
            .Where(p => p.PhotoGalleryId == galleryId)
            .GroupBy(p => p.SourceFolder)
            .Select(g => new { Source = g.Key, Total = g.Count(), Selected = g.Count(p => p.Selection != null), First = g.Min(p => p.PhotoNumber) })
            .ToListAsync(ct);

        // Merge the unrecorded ones into the gallery's folder; list in import order.
        return rows
            .Select(r => new { Source = r.Source ?? fallbackSource, r.Total, r.Selected, r.First })
            .Where(r => !string.IsNullOrWhiteSpace(r.Source))
            .GroupBy(r => r.Source!, StringComparer.OrdinalIgnoreCase)
            .OrderBy(g => g.Min(r => r.First))
            .Select(g => new ImportedSourceCounts(g.Key, g.Sum(r => r.Total), g.Sum(r => r.Selected)))
            .ToList();
    }

    public Task<List<Photo>> GetBySourceAsync(int galleryId, string sourceFolder, bool includeUnrecorded, CancellationToken ct = default) =>
        context.Photos
            .Where(p => p.PhotoGalleryId == galleryId
                        && (p.SourceFolder == sourceFolder || (includeUnrecorded && p.SourceFolder == null)))
            .ToListAsync(ct);

    public void RemoveRange(IEnumerable<Photo> photos) => context.Photos.RemoveRange(photos);

    public Task<string?> GetLatestSourceAsync(int galleryId, CancellationToken ct = default) =>
        context.Photos.AsNoTracking()
            .Where(p => p.PhotoGalleryId == galleryId && p.SourceFolder != null)
            .OrderByDescending(p => p.PhotoNumber)
            .Select(p => p.SourceFolder)
            .FirstOrDefaultAsync(ct);

    public void UpdateRange(IEnumerable<Photo> photos) => context.Photos.UpdateRange(photos);

    public async Task SetSelectionAsync(int galleryId, int photoId, int selectionType, DateTime now, CancellationToken ct = default)
    {
        var existing = await context.PhotoSelections.FirstOrDefaultAsync(s => s.PhotoId == photoId, ct);
        if (existing is null)
        {
            await context.PhotoSelections.AddAsync(new PhotoSelection
            {
                PhotoGalleryId = galleryId,
                PhotoId = photoId,
                SelectionType = selectionType,
                SelectedAt = now,
                UpdatedAt = now
            }, ct);
            return;
        }

        if (existing.SelectionType != selectionType)
        {
            existing.SelectionType = selectionType;
            existing.UpdatedAt = now;
        }
    }

    public Task UpdateSelectionTypeAsync(int photoId, int selectionType, DateTime now, CancellationToken ct = default) =>
        context.PhotoSelections.Where(s => s.PhotoId == photoId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.SelectionType, selectionType).SetProperty(x => x.UpdatedAt, now), ct);

    public async Task<bool> RemoveSelectionAsync(int photoId, CancellationToken ct = default)
    {
        var existing = await context.PhotoSelections.FirstOrDefaultAsync(s => s.PhotoId == photoId, ct);
        if (existing is null)
        {
            return false;
        }

        context.PhotoSelections.Remove(existing);
        return true;
    }
}
