using System.Globalization;
using Microsoft.EntityFrameworkCore;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Notifications;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public class PublicPhotoSelectionService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    INotificationService notificationService,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IPublicPhotoSelectionService
{
    private const string Module = "PhotoSelection";

    // ---- Reading -----------------------------------------------------------------------------

    public async Task<PublicAccess<PublicGalleryDto>> GetGalleryAsync(string token, CancellationToken ct = default)
    {
        var (gallery, failure) = await ResolveAsync(token, ct);
        if (gallery is null)
        {
            return PublicAccess<PublicGalleryDto>.Fail(failure!.Value);
        }

        var now = DateTime.UtcNow;
        if (gallery.FirstOpenedAt is null)
        {
            await galleryRepository.MarkFirstOpenedAsync(gallery.PhotoGalleryId, now, ct);
        }

        var counts = await galleryRepository.GetCountsAsync(gallery.PhotoGalleryId, ct);
        return PublicAccess<PublicGalleryDto>.Ok(new PublicGalleryDto
        {
            StudioName = gallery.Studio.StudioName,
            Title = gallery.Event.EventType?.Name ?? "Photo selection",
            CustomerName = gallery.Customer.FullName,
            EventDate = gallery.Event.EventDate,
            IsLocked = gallery.Status == GalleryStatuses.Locked,
            IsSubmitted = gallery.SubmittedAt is not null,
            SubmittedAt = gallery.SubmittedAt,
            ChangedSinceSubmit = PhotoGalleryService.ChangedSinceSubmit(gallery),
            ExpiresAt = gallery.ExpiresAt,
            Counts = PhotoGalleryService.ToDto(counts)
        });
    }

    public async Task<PublicAccess<PublicPhotosPageDto>> GetPhotosAsync(string token, PhotoFilter filter, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var (gallery, failure) = await ResolveAsync(token, ct);
        if (gallery is null)
        {
            return PublicAccess<PublicPhotosPageDto>.Fail(failure!.Value);
        }

        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 50 : pageSize;

        var (items, totalCount) = await photoRepository.GetPageAsync(gallery.PhotoGalleryId, filter, search, page, pageSize, ct);
        return PublicAccess<PublicPhotosPageDto>.Ok(new PublicPhotosPageDto
        {
            Items = items.Select(ToPublicPhoto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            HasMore = page * pageSize < totalCount
        });
    }

    public async Task<PublicAccess<GalleryCountsDto>> GetSummaryAsync(string token, CancellationToken ct = default)
    {
        var (gallery, failure) = await ResolveAsync(token, ct);
        if (gallery is null)
        {
            return PublicAccess<GalleryCountsDto>.Fail(failure!.Value);
        }

        return PublicAccess<GalleryCountsDto>.Ok(
            PhotoGalleryService.ToDto(await galleryRepository.GetCountsAsync(gallery.PhotoGalleryId, ct)));
    }

    // ---- Selecting ---------------------------------------------------------------------------

    public async Task<SelectionResult> SetSelectionAsync(string token, int photoId, int selectionType, CancellationToken ct = default)
    {
        var (gallery, failure) = await ResolveAsync(token, ct);
        if (gallery is null)
        {
            return SelectionResult.NoAccess(failure!.Value);
        }
        if (gallery.Status == GalleryStatuses.Locked)
        {
            return SelectionResult.Fail(SelectionFailureReason.Locked);
        }
        if (!SelectionTypes.IsValid(selectionType))
        {
            return SelectionResult.Fail(SelectionFailureReason.InvalidType);
        }
        if (await photoRepository.GetByIdAsync(gallery.PhotoGalleryId, photoId, ct) is null)
        {
            return SelectionResult.Fail(SelectionFailureReason.PhotoNotFound);
        }

        var now = DateTime.UtcNow;
        try
        {
            await photoRepository.SetSelectionAsync(gallery.PhotoGalleryId, photoId, selectionType, now, ct);
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Two taps arrived together and both tried to insert; the unique index on PhotoId let one
            // through. The photo is selected — just make sure it has the size asked for last.
            await photoRepository.UpdateSelectionTypeAsync(photoId, selectionType, now, ct);
        }

        await galleryRepository.MarkSelectionChangedAsync(gallery.PhotoGalleryId, now, ct);
        return await BuildSelectionResultAsync(gallery.PhotoGalleryId, photoId, ct);
    }

    public async Task<SelectionResult> RemoveSelectionAsync(string token, int photoId, CancellationToken ct = default)
    {
        var (gallery, failure) = await ResolveAsync(token, ct);
        if (gallery is null)
        {
            return SelectionResult.NoAccess(failure!.Value);
        }
        if (gallery.Status == GalleryStatuses.Locked)
        {
            return SelectionResult.Fail(SelectionFailureReason.Locked);
        }
        if (await photoRepository.GetByIdAsync(gallery.PhotoGalleryId, photoId, ct) is null)
        {
            return SelectionResult.Fail(SelectionFailureReason.PhotoNotFound);
        }

        try
        {
            if (await photoRepository.RemoveSelectionAsync(photoId, ct))
            {
                await unitOfWork.SaveChangesAsync(ct);
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            // Already removed by a parallel request — the outcome the customer asked for.
        }

        await galleryRepository.MarkSelectionChangedAsync(gallery.PhotoGalleryId, DateTime.UtcNow, ct);
        return await BuildSelectionResultAsync(gallery.PhotoGalleryId, photoId, ct);
    }

    // ---- Submitting --------------------------------------------------------------------------

    public async Task<SubmitResult> SubmitAsync(string token, CancellationToken ct = default)
    {
        var (gallery, failure) = await ResolveAsync(token, ct);
        if (gallery is null)
        {
            return SubmitResult.NoAccess(failure!.Value);
        }
        if (gallery.Status == GalleryStatuses.Locked)
        {
            return SubmitResult.Fail(SubmitFailureReason.Locked);
        }

        var counts = await galleryRepository.GetCountsAsync(gallery.PhotoGalleryId, ct);
        if (counts.Selected == 0)
        {
            return SubmitResult.Fail(SubmitFailureReason.NothingSelected);
        }

        var now = DateTime.UtcNow;
        var isNewSubmit = await galleryRepository.MarkSubmittedAsync(gallery.PhotoGalleryId, now, ct);

        if (isNewSubmit)
        {
            var eventName = gallery.Event.EventType?.Name ?? "event";
            var eventDate = gallery.Event.EventDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
            var when = now.ToLocalTime().ToString("dd MMM yyyy, hh:mm tt", CultureInfo.InvariantCulture);
            await notificationService.NotifyAsync(
                gallery.StudioId,
                "Photo selection submitted",
                $"{gallery.Customer.FullName} submitted their selection for the {eventName} on {eventDate}: " +
                $"{counts.Selected} photos ({counts.Normal} Normal, {counts.Big} Big) at {when}.",
                NotificationTypes.PhotoSelectionSubmitted,
                ct);
            await auditService.LogAsync($"Photo selection submitted for event {gallery.EventId} ({counts.Selected} photos)", Module, gallery.StudioId, ct);
        }

        return SubmitResult.Success(new SubmitResultDto
        {
            SubmittedAt = isNewSubmit ? now : gallery.SubmittedAt ?? now,
            AlreadySubmitted = !isNewSubmit,
            Counts = PhotoGalleryService.ToDto(counts)
        });
    }

    // ---- Helpers -----------------------------------------------------------------------------

    // The one gate every customer call goes through. Unknown, malformed and revoked tokens are all
    // "Invalid" (indistinguishable); only a real link that has run out says "Expired".
    private async Task<(PhotoGallery? Gallery, GalleryAccessFailure? Failure)> ResolveAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length is < 20 or > 100)
        {
            return (null, GalleryAccessFailure.Invalid);
        }

        var gallery = await galleryRepository.GetByTokenHashAsync(TokenHasher.Hash(token), ct);
        if (gallery is null || !gallery.IsLinkActive || !gallery.Studio.IsActive || gallery.Studio.IsBlocked)
        {
            return (null, GalleryAccessFailure.Invalid);
        }
        if (gallery.ExpiresAt is { } expiry && expiry < DateTime.UtcNow)
        {
            return (null, GalleryAccessFailure.Expired);
        }

        return (gallery, null);
    }

    private async Task<SelectionResult> BuildSelectionResultAsync(int galleryId, int photoId, CancellationToken ct)
    {
        var photo = await photoRepository.GetWithSelectionAsync(galleryId, photoId, ct);
        var counts = await galleryRepository.GetCountsAsync(galleryId, ct);
        return SelectionResult.Success(new PublicSelectionResultDto
        {
            Photo = ToPublicPhoto(photo!),
            Counts = PhotoGalleryService.ToDto(counts)
        });
    }

    private static PublicPhotoDto ToPublicPhoto(PhotoWithSelection p) => new()
    {
        PhotoId = p.Photo.PhotoId,
        PhotoNumber = p.Photo.PhotoNumber,
        FileName = p.Photo.FileName,
        ThumbnailUrl = p.Photo.ThumbnailPath,
        PreviewUrl = p.Photo.PreviewPath,
        Width = p.Photo.Width,
        Height = p.Photo.Height,
        SelectionType = p.SelectionType
    };
}
