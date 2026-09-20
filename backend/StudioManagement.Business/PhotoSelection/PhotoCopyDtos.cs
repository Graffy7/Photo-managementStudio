namespace StudioManagement.Business.PhotoSelection;

public class CopyJobDto
{
    public int JobId { get; set; }

    // "Create" the first time, "Sync" afterwards.
    public string Kind { get; set; } = null!;
    public string Status { get; set; } = null!;

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
}
