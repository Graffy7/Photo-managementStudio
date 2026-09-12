namespace StudioManagement.Business.PhotoSelection;

public class PhotoSelectionProjectDto
{
    public int PhotoSelectionProjectId { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public int? EventId { get; set; }
    public string? EventVenue { get; set; }
    public string Name { get; set; } = null!;
    public string SourceFolder { get; set; } = null!;
    public string? DestinationRootFolder { get; set; }
    public string Status { get; set; } = null!;

    public int? SelectionLimitTotal { get; set; }
    public int? SelectionLimitNormal { get; set; }
    public int? SelectionLimitBig { get; set; }

    public bool IsActive { get; set; }
    public bool HasLink { get; set; }
    public bool HasPin { get; set; }
    public DateTime? TokenExpiresAt { get; set; }

    public DateTime? LinkGeneratedAt { get; set; }
    public DateTime? FirstOpenedAt { get; set; }
    public DateTime? SelectionStartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReopenedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public int TotalPhotos { get; set; }
    public int SelectedCount { get; set; }
    public int NormalCount { get; set; }
    public int BigCount { get; set; }
}

public class CreatePhotoSelectionProjectRequestDto
{
    public int CustomerId { get; set; }
    public int? EventId { get; set; }
    public string Name { get; set; } = null!;
    public string SourceFolder { get; set; } = null!;
    public string? DestinationRootFolder { get; set; }
    public int? SelectionLimitTotal { get; set; }
    public int? SelectionLimitNormal { get; set; }
    public int? SelectionLimitBig { get; set; }
}

public class GenerateLinkRequestDto
{
    public int? ExpiresInDays { get; set; }
    public string? Pin { get; set; }
}

public class GenerateLinkResultDto
{
    public string Token { get; set; } = null!;
    public DateTime? TokenExpiresAt { get; set; }
}

public class PhotoDto
{
    public int PhotoId { get; set; }
    public int PhotoNumber { get; set; }
    public string OriginalFileName { get; set; } = null!;
    public string ThumbnailUrl { get; set; } = null!;
    public string PreviewUrl { get; set; } = null!;
    public string SelectionType { get; set; } = null!;
}

public class CompletedEventPhotoSelectionDto
{
    public int EventId { get; set; }
    public DateTime EventDate { get; set; }
    public string? Venue { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;

    // Null means no selection project exists yet for this event at all.
    public int? PhotoSelectionProjectId { get; set; }
    public string? Status { get; set; }
}

public class PhotoActivityDto
{
    public string Action { get; set; } = null!;
    public int? PhotoNumber { get; set; }
    public string? OldSelectionType { get; set; }
    public string? NewSelectionType { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PhotoProcessingJobItemDto
{
    public int PhotoNumber { get; set; }
    public string OriginalFileName { get; set; } = null!;
    public string Result { get; set; } = null!;
    public string? ErrorMessage { get; set; }
}

public class FolderBrowseEntryDto
{
    public string Name { get; set; } = null!;
    public string FullPath { get; set; } = null!;
}

public class FolderBrowseFileEntryDto
{
    public string Name { get; set; } = null!;
    public string FullPath { get; set; } = null!;
    public bool IsImage { get; set; }
}

public class FolderBrowseResultDto
{
    // Null at the very top level (drive list) — there's nothing "above" that to select or go up to.
    public string? CurrentPath { get; set; }
    public string? ParentPath { get; set; }
    public List<FolderBrowseEntryDto> Folders { get; set; } = [];
    public List<FolderBrowseFileEntryDto> Files { get; set; } = [];
}

public class PhotoProcessingJobDto
{
    public int PhotoProcessingJobId { get; set; }
    public string Status { get; set; } = null!;
    public int TotalCount { get; set; }
    public int CompletedCount { get; set; }
    public int MissingCount { get; set; }
    public int FailedCount { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<PhotoProcessingJobItemDto> Items { get; set; } = [];
}
