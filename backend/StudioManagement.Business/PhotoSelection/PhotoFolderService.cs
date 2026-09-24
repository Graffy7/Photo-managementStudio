using StudioManagement.Business.Audit;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

// Delivery folders for one event's gallery. A folder is only a grouping: creating, renaming or
// removing one never touches a photo file, a preview or a customer's selection.
public class PhotoFolderService(
    IPhotoFolderRepository folderRepository,
    IPhotoGalleryRepository galleryRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IPhotoFolderService
{
    private const string Module = "PhotoSelection";

    public async Task<List<PhotoFolderDto>?> GetAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return null;
        }

        // Galleries imported before folders existed get their structure worked out from the paths
        // the importer already recorded - once, the first time they are opened. Running it again
        // would undo any folder the studio has since deleted.
        if (gallery.FoldersBackfilledAt is null)
        {
            await folderRepository.BackfillFromPathsAsync(studioId, galleryId, ct);
            await galleryRepository.MarkFoldersBackfilledAsync(galleryId, DateTime.UtcNow, ct);
            await unitOfWork.SaveChangesAsync(ct);
        }

        return await BuildAsync(galleryId, ct);
    }

    private async Task<List<PhotoFolderDto>> BuildAsync(int galleryId, CancellationToken ct)
    {
        var folders = await folderRepository.GetByGalleryAsync(galleryId, ct);
        var counts = await folderRepository.GetCountsAsync(galleryId, ct);

        var items = folders.Select(f =>
        {
            var c = counts.FirstOrDefault(x => x.FolderId == f.PhotoFolderId);
            return new PhotoFolderDto
            {
                FolderId = f.PhotoFolderId,
                Name = f.Name,
                SortOrder = f.SortOrder,
                PhotoCount = c?.Total ?? 0,
                SelectedCount = c?.Selected ?? 0,
                IsDelivered = f.IsDelivered,
                DeliveredAt = f.DeliveredAt
            };
        }).ToList();

        // Anything not filed is shown as one last pseudo-folder so no photo can hide from the
        // customer. It has no id, so it can't be renamed or removed.
        var unfiled = counts.FirstOrDefault(c => c.FolderId is null);
        if (unfiled is not null && unfiled.Total > 0)
        {
            items.Add(new PhotoFolderDto
            {
                FolderId = 0,
                Name = "Other",
                SortOrder = int.MaxValue,
                PhotoCount = unfiled.Total,
                SelectedCount = unfiled.Selected,
                IsDelivered = false
            });
        }

        return items;
    }

    public async Task<FolderResult> CreateAsync(int studioId, int galleryId, SaveFolderRequestDto request, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return FolderResult.Fail(FolderFailureReason.GalleryNotFound);
        }

        var name = request.Name.Trim();
        if (await folderRepository.GetByNameAsync(galleryId, name, ct) is not null)
        {
            return FolderResult.Fail(FolderFailureReason.DuplicateName);
        }

        var now = DateTime.UtcNow;
        var folder = new PhotoFolder
        {
            StudioId = studioId,
            PhotoGalleryId = galleryId,
            Name = name,
            SortOrder = await folderRepository.GetMaxSortOrderAsync(galleryId, ct) + 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        await folderRepository.AddAsync(folder, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Delivery folder '{name}' created for gallery {galleryId}", Module, studioId, ct);

        return FolderResult.Success(new PhotoFolderDto
        {
            FolderId = folder.PhotoFolderId,
            Name = folder.Name,
            SortOrder = folder.SortOrder
        });
    }

    public async Task<FolderResult> RenameAsync(int studioId, int galleryId, int folderId, SaveFolderRequestDto request, CancellationToken ct = default)
    {
        var folder = await FindAsync(studioId, galleryId, folderId, ct);
        if (folder is null)
        {
            return FolderResult.Fail(FolderFailureReason.FolderNotFound);
        }

        var name = request.Name.Trim();
        var clash = await folderRepository.GetByNameAsync(galleryId, name, ct);
        if (clash is not null && clash.PhotoFolderId != folderId)
        {
            return FolderResult.Fail(FolderFailureReason.DuplicateName);
        }

        var previous = folder.Name;
        folder.Name = name;
        folder.UpdatedAt = DateTime.UtcNow;
        folderRepository.Update(folder);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Delivery folder '{previous}' renamed to '{name}'", Module, studioId, ct);

        return FolderResult.Success(new PhotoFolderDto { FolderId = folder.PhotoFolderId, Name = folder.Name });
    }

    public async Task<FolderResult> SetDeliveredAsync(int studioId, int galleryId, int folderId, bool isDelivered, CancellationToken ct = default)
    {
        var folder = await FindAsync(studioId, galleryId, folderId, ct);
        if (folder is null)
        {
            return FolderResult.Fail(FolderFailureReason.FolderNotFound);
        }

        var now = DateTime.UtcNow;
        folder.IsDelivered = isDelivered;
        folder.DeliveredAt = isDelivered ? now : null;
        folder.UpdatedAt = now;
        folderRepository.Update(folder);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(
            $"Delivery folder '{folder.Name}' marked {(isDelivered ? "delivered" : "pending")}", Module, studioId, ct);

        return FolderResult.Success(new PhotoFolderDto
        {
            FolderId = folder.PhotoFolderId,
            Name = folder.Name,
            IsDelivered = folder.IsDelivered,
            DeliveredAt = folder.DeliveredAt
        });
    }

    public async Task<FolderResult> DeleteAsync(int studioId, int galleryId, int folderId, CancellationToken ct = default)
    {
        var folder = await FindAsync(studioId, galleryId, folderId, ct);
        if (folder is null)
        {
            return FolderResult.Fail(FolderFailureReason.FolderNotFound);
        }

        // Photos are let go of first, so removing the folder can never take a photo with it.
        await folderRepository.UnfilePhotosAsync(folderId, ct);
        folderRepository.Remove(folder);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Delivery folder '{folder.Name}' removed from gallery {galleryId}", Module, studioId, ct);
        return FolderResult.Success();
    }

    private async Task<PhotoFolder?> FindAsync(int studioId, int galleryId, int folderId, CancellationToken ct)
    {
        var folder = await folderRepository.GetByIdAsync(studioId, folderId, ct);
        return folder is null || folder.PhotoGalleryId != galleryId ? null : folder;
    }
}
