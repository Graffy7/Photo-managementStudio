namespace StudioManagement.Data.Entities;

public class PhotoImportJob
{
    public int PhotoImportJobId { get; set; }
    public int PhotoGalleryId { get; set; }
    public string Status { get; set; } = null!;
    public string SourceFolder { get; set; } = null!;
    public int TotalCount { get; set; }
    public int ProcessedCount { get; set; }
    public int FailedCount { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public PhotoGallery Gallery { get; set; } = null!;
}
