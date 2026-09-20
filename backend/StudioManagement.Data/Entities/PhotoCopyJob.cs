namespace StudioManagement.Data.Entities;

// One run of "Create Selected Photos" / "Sync Selected Photos": copies the customer's chosen
// originals into Customer Selection\Normal and \Big Size next to the originals, and removes the
// generated copies that no longer match. Counters drive the owner's progress display.
public class PhotoCopyJob
{
    public int PhotoCopyJobId { get; set; }
    public int PhotoGalleryId { get; set; }
    public string Kind { get; set; } = null!;
    public string Status { get; set; } = null!;

    // Selected photos at the moment the job started (what ProcessedCount counts toward).
    public int TotalCount { get; set; }
    public int NormalCount { get; set; }
    public int BigCount { get; set; }
    public int ProcessedCount { get; set; }

    public int CreatedCount { get; set; }
    public int ExistsCount { get; set; }
    public int RemovedCount { get; set; }
    public int FailedCount { get; set; }

    public string? ErrorMessage { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public PhotoGallery Gallery { get; set; } = null!;
}
