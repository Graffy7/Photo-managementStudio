using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Common;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public partial class PhotoGalleryService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    IPhotoCopyRepository copyRepository,
    IEventRepository eventRepository,
    ILinkTokenProtector tokenProtector,
    PhotoGalleryOptions options,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IPhotoGalleryService
{
    private const string Module = "PhotoSelection";

    // ---- Owner list --------------------------------------------------------------------------

    public async Task<PagedResult<CompletedEventGalleryDto>> GetCompletedEventsAsync(int studioId, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (events, totalCount) = await galleryRepository.GetCompletedEventsAsync(studioId, search, page, pageSize, ct);
        var galleries = await galleryRepository.GetByEventIdsAsync(studioId, events.Select(e => e.EventId).ToList(), ct);
        var counts = await galleryRepository.GetCountsForGalleriesAsync(galleries.Select(g => g.PhotoGalleryId).ToList(), ct);
        var now = DateTime.UtcNow;

        var items = events.Select(e =>
        {
            var gallery = galleries.FirstOrDefault(g => g.EventId == e.EventId);
            var galleryCounts = gallery is not null && counts.TryGetValue(gallery.PhotoGalleryId, out var c)
                ? c
                : new GallerySelectionCounts(0, 0, 0);

            return new CompletedEventGalleryDto
            {
                EventId = e.EventId,
                EventDate = e.EventDate,
                EventTypeName = e.EventType?.Name,
                Venue = e.Venue,
                CustomerId = e.CustomerId,
                CustomerName = e.Customer.FullName,
                GalleryId = gallery?.PhotoGalleryId,
                State = ComputeState(gallery, galleryCounts.Total, now),
                PhotoCount = galleryCounts.Total,
                SelectedCount = galleryCounts.Selected,
                SubmittedAt = gallery?.SubmittedAt
            };
        }).ToList();

        return new PagedResult<CompletedEventGalleryDto> { Items = items, TotalCount = totalCount, Page = page, PageSize = pageSize };
    }

    // ---- One gallery -------------------------------------------------------------------------

    public async Task<OwnerGalleryDto?> GetOrCreateForEventAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var existing = await galleryRepository.GetByEventIdAsync(studioId, eventId, ct);
        if (existing is not null)
        {
            return await BuildDtoAsync(existing, ct);
        }

        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        try
        {
            await galleryRepository.AddAsync(new PhotoGallery
            {
                StudioId = studioId,
                CustomerId = @event.CustomerId,
                EventId = eventId,
                Status = GalleryStatuses.Open,
                IsLinkActive = false,
                CreatedAt = now,
                UpdatedAt = now
            }, ct);
            await unitOfWork.SaveChangesAsync(ct);
            await auditService.LogAsync($"Photo gallery created for event {eventId}", Module, studioId, ct);
        }
        catch (DbUpdateException)
        {
            // Two requests opened the same event at once; the unique index let one win. Use theirs.
        }

        var created = await galleryRepository.GetByEventIdAsync(studioId, eventId, ct);
        return created is null ? null : await BuildDtoAsync(created, ct);
    }

    public async Task<OwnerGalleryDto?> GetAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        return gallery is null ? null : await BuildDtoAsync(gallery, ct);
    }

    // ---- Link, lock --------------------------------------------------------------------------

    public async Task<GenerateLinkResult> GenerateLinkAsync(int studioId, int galleryId, int expiresInDays, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return GenerateLinkResult.Fail(LinkFailureReason.GalleryNotFound);
        }

        var counts = await galleryRepository.GetCountsAsync(galleryId, ct);
        if (counts.Total == 0)
        {
            return GenerateLinkResult.Fail(LinkFailureReason.NoPhotos);
        }
        if (gallery.PreviewsPurgedAt is not null)
        {
            return GenerateLinkResult.Fail(LinkFailureReason.PreviewsRemoved);
        }

        // A link sent mid-import would show the customer a half-built gallery.
        var job = await galleryRepository.GetLatestJobAsync(galleryId, ct);
        if (job is not null && job.Status is ImportJobStatuses.Queued or ImportJobStatuses.Running)
        {
            return GenerateLinkResult.Fail(LinkFailureReason.ImportRunning);
        }

        // A new token replaces the old one, so a previously shared link stops working.
        var now = DateTime.UtcNow;
        var token = TokenHasher.GenerateRawToken();
        var expiresAt = now.AddDays(expiresInDays);
        await galleryRepository.SetLinkAsync(galleryId, TokenHasher.Hash(token), tokenProtector.Protect(token), expiresAt, now, ct);
        await auditService.LogAsync($"Photo selection link generated for event {gallery.EventId} (valid {expiresInDays} days)", Module, studioId, ct);

        return GenerateLinkResult.Success(new GenerateLinkResultDto { Token = token, ExpiresAt = expiresAt });
    }

    public async Task<bool> RevokeLinkAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return false;
        }

        await galleryRepository.RevokeLinkAsync(galleryId, DateTime.UtcNow, ct);
        await auditService.LogAsync($"Photo selection link revoked for event {gallery.EventId}", Module, studioId, ct);
        return true;
    }

    public async Task<bool> SetLockedAsync(int studioId, int galleryId, bool locked, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return false;
        }

        await galleryRepository.SetStatusAsync(galleryId, locked ? GalleryStatuses.Locked : GalleryStatuses.Open, DateTime.UtcNow, ct);
        await auditService.LogAsync($"Photo selection {(locked ? "locked" : "unlocked")} for event {gallery.EventId}", Module, studioId, ct);
        return true;
    }

    // ---- Photos and export -------------------------------------------------------------------

    public async Task<OwnerPhotosPageDto?> GetPhotosAsync(int studioId, int galleryId, PhotoFilter filter, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return null;
        }

        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 200 ? 60 : pageSize;

        var (items, totalCount) = await photoRepository.GetPageAsync(galleryId, filter, search, page, pageSize, ct);
        return new OwnerPhotosPageDto
        {
            Items = items.Select(p => new OwnerPhotoDto
            {
                PhotoId = p.Photo.PhotoId,
                PhotoNumber = p.Photo.PhotoNumber,
                FileName = p.Photo.FileName,
                ThumbnailUrl = gallery.PreviewsPurgedAt is null ? p.Photo.ThumbnailPath : null,
                PreviewUrl = gallery.PreviewsPurgedAt is null ? p.Photo.PreviewPath : null,
                Width = p.Photo.Width,
                Height = p.Photo.Height,
                SelectionType = p.SelectionType is { } t ? SelectionTypes.Label(t) : null,
                SelectedAt = p.SelectedAt
            }).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            HasMore = page * pageSize < totalCount
        };
    }

    public async Task<GalleryExport?> ExportSelectionAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return null;
        }

        var selected = await photoRepository.GetSelectedAsync(galleryId, ct);
        var customer = gallery.Customer.FullName;
        var eventLabel = $"{gallery.Event.EventType?.Name ?? "Event"} {gallery.Event.EventDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture)}";

        var sb = new StringBuilder();
        sb.Append("Photo ID,File Name,Selection Type,Customer,Event,Selection Date\r\n");
        foreach (var row in selected)
        {
            sb.Append(string.Join(',',
                Csv(row.Photo.PhotoNumber.ToString(CultureInfo.InvariantCulture)),
                Csv(row.Photo.FileName),
                Csv(row.SelectionType is { } t ? SelectionTypes.Label(t) : ""),
                Csv(customer),
                Csv(eventLabel),
                Csv(row.SelectedAt?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) ?? "")));
            sb.Append("\r\n");
        }

        // UTF-8 with a BOM so Excel opens non-English file/customer names correctly.
        var content = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(sb.ToString()))
            .ToArray();

        var safeName = UnsafeFileChars().Replace(customer, "").Trim().Replace(' ', '-');
        return new GalleryExport
        {
            Content = content,
            FileName = $"photo-selection-{(safeName.Length > 0 ? safeName : "customer")}-event-{gallery.EventId}.csv"
        };
    }

    // ---- Share / reminder --------------------------------------------------------------------

    public async Task<ShareMessageResult> GetShareMessageAsync(int studioId, int galleryId, string baseUrl, bool reminder, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return ShareMessageResult.Fail(ShareFailureReason.GalleryNotFound);
        }

        var token = gallery.IsLinkActive ? tokenProtector.Unprotect(gallery.TokenProtected) : null;
        if (token is null || (gallery.ExpiresAt is { } expiry && expiry < DateTime.UtcNow))
        {
            return ShareMessageResult.Fail(ShareFailureReason.NoActiveLink);
        }

        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri) || baseUri.Scheme is not ("http" or "https"))
        {
            return ShareMessageResult.Fail(ShareFailureReason.InvalidBaseUrl);
        }

        var link = $"{baseUri.GetLeftPart(UriPartial.Authority)}/photo-selection/{token}";
        var firstName = gallery.Customer.FullName.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "there";
        var studioName = gallery.Studio.StudioName;
        var validity = gallery.ExpiresAt is { } e ? $"\nThis link is valid until {e.ToLocalTime().ToString("dd MMM yyyy", CultureInfo.InvariantCulture)}." : "";

        var message = reminder
            ? $"Hello {firstName}, a gentle reminder to choose your photos from {studioName}.\nPlease select your favourites here:\n{link}{validity}"
            : $"Hello {firstName}, your photos from {studioName} are ready!\nPlease select your favourites here:\n{link}{validity}";

        var phone = NormalizePhone(gallery.Customer.MobileNumber);
        var text = Uri.EscapeDataString(message);
        return ShareMessageResult.Success(new ShareMessageDto
        {
            Message = message,
            PhoneNumber = phone,
            WhatsAppUrl = phone is null ? $"https://wa.me/?text={text}" : $"https://wa.me/{phone}?text={text}"
        });
    }

    // ---- Helpers -----------------------------------------------------------------------------

    private async Task<OwnerGalleryDto> BuildDtoAsync(PhotoGallery gallery, CancellationToken ct)
    {
        var counts = await galleryRepository.GetCountsAsync(gallery.PhotoGalleryId, ct);
        var job = await galleryRepository.GetLatestJobAsync(gallery.PhotoGalleryId, ct);
        var copyJob = await copyRepository.GetLatestJobAsync(gallery.PhotoGalleryId, ct);
        var now = DateTime.UtcNow;
        var hasLink = gallery.IsLinkActive && gallery.TokenHash is not null;

        return new OwnerGalleryDto
        {
            GalleryId = gallery.PhotoGalleryId,
            EventId = gallery.EventId,
            CustomerId = gallery.CustomerId,
            CustomerName = gallery.Customer.FullName,
            CustomerMobileNumber = gallery.Customer.MobileNumber,
            EventTypeName = gallery.Event.EventType?.Name,
            EventDate = gallery.Event.EventDate,
            Venue = gallery.Event.Venue,
            SourceFolder = gallery.SourceFolder,
            State = ComputeState(gallery, counts.Total, now),
            Status = gallery.Status,
            IsLocked = gallery.Status == GalleryStatuses.Locked,
            HasActiveLink = hasLink,
            IsExpired = hasLink && gallery.ExpiresAt < now,
            LinkToken = hasLink ? tokenProtector.Unprotect(gallery.TokenProtected) : null,
            ExpiresAt = gallery.ExpiresAt,
            LinkGeneratedAt = gallery.LinkGeneratedAt,
            FirstOpenedAt = gallery.FirstOpenedAt,
            LastSelectionAt = gallery.LastSelectionAt,
            SubmittedAt = gallery.SubmittedAt,
            ChangedSinceSubmit = ChangedSinceSubmit(gallery),
            PreviewsPurged = gallery.PreviewsPurgedAt is not null,
            Counts = ToDto(counts),
            LatestImport = job is null ? null : new ImportJobDto
            {
                JobId = job.PhotoImportJobId,
                Status = job.Status,
                TotalCount = job.TotalCount,
                ProcessedCount = job.ProcessedCount,
                FailedCount = job.FailedCount,
                ErrorMessage = job.ErrorMessage,
                StartedAt = job.StartedAt,
                CompletedAt = job.CompletedAt
            },
            SelectionFolder = string.IsNullOrWhiteSpace(gallery.SourceFolder) ? null : Path.Combine(gallery.SourceFolder, SelectionFolders.RootName),
            SelectionCreatedAt = gallery.SelectionCreatedAt,
            SelectionSyncedAt = gallery.SelectionSyncedAt,
            SelectionOutOfSync = gallery.SelectionCreatedAt is not null &&
                                 (gallery.SelectionSyncedAt is null || gallery.LastSelectionAt > gallery.SelectionSyncedAt),
            LatestCopyJob = copyJob is null ? null : PhotoSelectionCopyService.ToDto(copyJob)
        };
    }

    internal static GalleryCountsDto ToDto(GallerySelectionCounts counts) => new()
    {
        Total = counts.Total,
        Selected = counts.Selected,
        Normal = counts.Normal,
        Big = counts.Big,
        NotSelected = counts.NotSelected
    };

    internal static bool ChangedSinceSubmit(PhotoGallery gallery) =>
        gallery.SubmittedAt is { } submitted && gallery.LastSelectionAt is { } last && last > submitted;

    // Locked and Submitted outrank Expired: once the customer has sent a selection the owner cares
    // about that, not that the link has since lapsed.
    internal static string ComputeState(PhotoGallery? gallery, int photoCount, DateTime now)
    {
        if (gallery is null || photoCount == 0)
        {
            return GallerySelectionStates.NoPhotos;
        }
        if (gallery.Status == GalleryStatuses.Locked)
        {
            return GallerySelectionStates.Locked;
        }
        if (gallery.SubmittedAt is not null)
        {
            return GallerySelectionStates.Submitted;
        }

        var hasLink = gallery.IsLinkActive && gallery.TokenHash is not null;
        if (!hasLink)
        {
            return GallerySelectionStates.NeedToSend;
        }
        return gallery.ExpiresAt < now ? GallerySelectionStates.Expired : GallerySelectionStates.Pending;
    }

    // Digits only, with the studio's configured country code added to bare 10-digit numbers.
    // Anything that can't be a real phone number yields null (WhatsApp then lets the owner pick).
    private string? NormalizePhone(string? mobile)
    {
        var digits = NonDigits().Replace(mobile ?? "", "").TrimStart('0');
        if (digits.Length == 10 && options.DefaultCountryCode.Length > 0)
        {
            digits = options.DefaultCountryCode + digits;
        }
        return digits.Length is >= 8 and <= 15 ? digits : null;
    }

    // Quotes every field, and defuses spreadsheet formulas (a file named "=cmd|..." must not run
    // when the owner opens the export in Excel).
    private static string Csv(string value)
    {
        if (value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
        {
            value = "'" + value;
        }
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigits();

    [GeneratedRegex(@"[^\p{L}\p{N} _-]")]
    private static partial Regex UnsafeFileChars();
}
