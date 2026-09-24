using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PhotoFolderRepository(AppDbContext context) : IPhotoFolderRepository
{
    public Task<List<PhotoFolder>> GetByGalleryAsync(int galleryId, CancellationToken ct = default) =>
        context.PhotoFolders
            .AsNoTracking()
            .Where(f => f.PhotoGalleryId == galleryId)
            .OrderBy(f => f.SortOrder).ThenBy(f => f.PhotoFolderId)
            .ToListAsync(ct);

    public Task<PhotoFolder?> GetByIdAsync(int studioId, int folderId, CancellationToken ct = default) =>
        context.PhotoFolders.FirstOrDefaultAsync(f => f.StudioId == studioId && f.PhotoFolderId == folderId, ct);

    public Task<PhotoFolder?> GetByNameAsync(int galleryId, string name, CancellationToken ct = default) =>
        context.PhotoFolders.FirstOrDefaultAsync(f => f.PhotoGalleryId == galleryId && f.Name == name, ct);

    public async Task<List<FolderPhotoCounts>> GetCountsAsync(int galleryId, CancellationToken ct = default)
    {
        var rows = await context.Photos
            .AsNoTracking()
            .Where(p => p.PhotoGalleryId == galleryId && p.IsActive)
            .GroupBy(p => p.PhotoFolderId)
            .Select(g => new
            {
                FolderId = g.Key,
                Total = g.Count(),
                Selected = g.Count(p => p.Selection != null)
            })
            .ToListAsync(ct);

        return rows.Select(r => new FolderPhotoCounts(r.FolderId, r.Total, r.Selected)).ToList();
    }

    public async Task<int> GetMaxSortOrderAsync(int galleryId, CancellationToken ct = default) =>
        await context.PhotoFolders
            .Where(f => f.PhotoGalleryId == galleryId)
            .Select(f => (int?)f.SortOrder)
            .MaxAsync(ct) ?? 0;

    public async Task AddAsync(PhotoFolder folder, CancellationToken ct = default) =>
        await context.PhotoFolders.AddAsync(folder, ct);

    public void Update(PhotoFolder folder) => context.PhotoFolders.Update(folder);

    public void Remove(PhotoFolder folder) => context.PhotoFolders.Remove(folder);

    public Task<int> UnfilePhotosAsync(int folderId, CancellationToken ct = default) =>
        context.Photos
            .Where(p => p.PhotoFolderId == folderId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.PhotoFolderId, (int?)null), ct);

    // The importer has always stored each photo's path relative to the source folder, so the folder
    // a photo belongs in is the first segment of that path. This reads those paths and files the
    // photos accordingly - no file on disk is touched and no photo row is created or removed.
    public async Task<int> BackfillFromPathsAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var unfiled = await context.Photos
            .Where(p => p.PhotoGalleryId == galleryId && p.PhotoFolderId == null)
            .ToListAsync(ct);
        if (unfiled.Count == 0)
        {
            return 0;
        }

        var existing = await context.PhotoFolders
            .Where(f => f.PhotoGalleryId == galleryId)
            .ToListAsync(ct);
        var byName = existing.ToDictionary(f => f.Name, StringComparer.OrdinalIgnoreCase);
        var nextSort = existing.Count == 0 ? 1 : existing.Max(f => f.SortOrder) + 1;
        var now = DateTime.UtcNow;
        var filed = 0;

        foreach (var photo in unfiled)
        {
            var segments = photo.SourceRelativePath.Split(['\\', '/'], StringSplitOptions.RemoveEmptyEntries);
            // A photo loose in the root of the source folder has no folder name to take.
            if (segments.Length < 2)
            {
                continue;
            }

            var name = segments[0];
            if (!byName.TryGetValue(name, out var folder))
            {
                folder = new PhotoFolder
                {
                    StudioId = studioId,
                    PhotoGalleryId = galleryId,
                    Name = name,
                    SortOrder = nextSort++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await context.PhotoFolders.AddAsync(folder, ct);
                byName[name] = folder;
            }

            photo.Folder = folder;
            filed++;
        }

        return filed;
    }
}
