namespace StudioManagement.Data.Entities;

public class PhotoProcessingJobItem
{
    public int PhotoProcessingJobItemId { get; set; }
    public int PhotoProcessingJobId { get; set; }
    public int PhotoId { get; set; }
    public string Result { get; set; } = null!;
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }

    public PhotoProcessingJob Job { get; set; } = null!;
    public Photo Photo { get; set; } = null!;
}
