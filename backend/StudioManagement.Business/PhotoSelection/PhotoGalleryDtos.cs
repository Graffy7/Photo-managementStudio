namespace StudioManagement.Business.PhotoSelection;

public class GalleryCountsDto
{
    public int Total { get; set; }
    public int Selected { get; set; }
    public int Normal { get; set; }
    public int Big { get; set; }
    public int NotSelected { get; set; }
}

// What the owner's list page shows for a gallery:
//   NoPhotos   - nothing imported yet
//   NeedToSend - photos are ready but there is no active customer link
//   Pending    - link sent, the customer has not submitted
//   Submitted  - the customer submitted
//   Locked     - the owner locked the selection
//   Expired    - the link's expiry date has passed
public static class GallerySelectionStates
{
    public const string NoPhotos = "NoPhotos";
    public const string NeedToSend = "NeedToSend";
    public const string Pending = "Pending";
    public const string Submitted = "Submitted";
    public const string Locked = "Locked";
    public const string Expired = "Expired";
}

public class ImportJobDto
{
    public int JobId { get; set; }
    public string Status { get; set; } = null!;
    public int TotalCount { get; set; }
    public int ProcessedCount { get; set; }
    public int FailedCount { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class OwnerGalleryDto
{
    public int GalleryId { get; set; }
    public int EventId { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public string? CustomerMobileNumber { get; set; }
    public string? EventTypeName { get; set; }
    public DateTime EventDate { get; set; }
    public string? Venue { get; set; }

    // The owner's own import folder (on their machine) - shown to the owner only, never to customers.
    public string? SourceFolder { get; set; }

    public string State { get; set; } = null!;
    public string Status { get; set; } = null!;
    public bool IsLocked { get; set; }
    public bool HasActiveLink { get; set; }
    public bool IsExpired { get; set; }
    public string? LinkToken { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LinkGeneratedAt { get; set; }
    public DateTime? FirstOpenedAt { get; set; }
    public DateTime? LastSelectionAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public bool ChangedSinceSubmit { get; set; }
    public bool PreviewsPurged { get; set; }
    public GalleryCountsDto Counts { get; set; } = new();
    public ImportJobDto? LatestImport { get; set; }
}

public class CompletedEventGalleryDto
{
    public int EventId { get; set; }
    public DateTime EventDate { get; set; }
    public string? EventTypeName { get; set; }
    public string? Venue { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public int? GalleryId { get; set; }
    public string State { get; set; } = null!;
    public int PhotoCount { get; set; }
    public int SelectedCount { get; set; }
    public DateTime? SubmittedAt { get; set; }
}

public class OwnerPhotoDto
{
    public int PhotoId { get; set; }
    public int PhotoNumber { get; set; }
    public string FileName { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public string? PreviewUrl { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public string? SelectionType { get; set; }
    public DateTime? SelectedAt { get; set; }
}

public class OwnerPhotosPageDto
{
    public List<OwnerPhotoDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public bool HasMore { get; set; }
}

public class ImportRequestDto
{
    public string SourceFolder { get; set; } = null!;
}

public class GenerateLinkRequestDto
{
    // Days from now until the link stops working (the owner picks 7/15/30/60 or a custom number).
    public int ExpiresInDays { get; set; }
}

public class GenerateLinkResultDto
{
    public string Token { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
}

public class ShareMessageDto
{
    public string Message { get; set; } = null!;
    public string? PhoneNumber { get; set; }

    // wa.me link with the message pre-filled (and the customer's number when it looks valid).
    public string WhatsAppUrl { get; set; } = null!;
}

public class FolderBrowseEntryDto
{
    public string Name { get; set; } = null!;
    public string FullPath { get; set; } = null!;
}

public class FolderBrowseResultDto
{
    public string? CurrentPath { get; set; }
    public string? ParentPath { get; set; }
    public List<FolderBrowseEntryDto> Folders { get; set; } = [];
    public int ImageCount { get; set; }
}

// ---- Customer-facing shapes: deliberately thin. No server paths, no source folder, no internal
// ids beyond the photo id needed to select it.

public class PublicGalleryDto
{
    public string StudioName { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string CustomerName { get; set; } = null!;
    public DateTime EventDate { get; set; }
    public bool IsLocked { get; set; }
    public bool IsSubmitted { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public bool ChangedSinceSubmit { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public GalleryCountsDto Counts { get; set; } = new();
}

public class PublicPhotoDto
{
    public int PhotoId { get; set; }
    public int PhotoNumber { get; set; }
    public string FileName { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public string? PreviewUrl { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }

    // 1 = Normal, 2 = Big, null = not selected.
    public int? SelectionType { get; set; }
}

public class PublicPhotosPageDto
{
    public List<PublicPhotoDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public bool HasMore { get; set; }
}

public class SetSelectionRequestDto
{
    public int SelectionType { get; set; }
}

// Every selection change returns the fresh counters, so the UI can trust the server's numbers.
public class PublicSelectionResultDto
{
    public PublicPhotoDto Photo { get; set; } = null!;
    public GalleryCountsDto Counts { get; set; } = new();
}

public class SubmitResultDto
{
    public DateTime SubmittedAt { get; set; }
    public bool AlreadySubmitted { get; set; }
    public GalleryCountsDto Counts { get; set; } = new();
}
