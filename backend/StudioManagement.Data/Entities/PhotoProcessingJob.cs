namespace StudioManagement.Data.Entities;

public class PhotoProcessingJob
{
    public int PhotoProcessingJobId { get; set; }
    public int PhotoSelectionProjectId { get; set; }
    public string Status { get; set; } = null!;

    public int TotalCount { get; set; }
    public int CompletedCount { get; set; }
    public int MissingCount { get; set; }
    public int FailedCount { get; set; }

    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public PhotoSelectionProject SelectionProject { get; set; } = null!;
    public ICollection<PhotoProcessingJobItem> Items { get; set; } = new List<PhotoProcessingJobItem>();
}
