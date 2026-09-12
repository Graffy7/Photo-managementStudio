namespace StudioManagement.Data.Entities;

public class PhotoSelectionProject : ITenantEntity
{
    public int PhotoSelectionProjectId { get; set; }
    public int StudioId { get; set; }
    public int CustomerId { get; set; }
    public int? EventId { get; set; }
    public string Name { get; set; } = null!;
    public string SourceFolder { get; set; } = null!;
    public string? DestinationRootFolder { get; set; }
    public string Status { get; set; } = null!;

    public int? SelectionLimitTotal { get; set; }
    public int? SelectionLimitNormal { get; set; }
    public int? SelectionLimitBig { get; set; }

    public string? AccessTokenHash { get; set; }
    public DateTime? TokenExpiresAt { get; set; }
    public string? PinHash { get; set; }
    public bool IsActive { get; set; } = true;

    public DateTime? LinkGeneratedAt { get; set; }
    public DateTime? FirstOpenedAt { get; set; }
    public DateTime? SelectionStartedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ReopenedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public Event? Event { get; set; }
    public ICollection<Photo> Photos { get; set; } = new List<Photo>();
    public ICollection<PhotoSelectionActivity> Activities { get; set; } = new List<PhotoSelectionActivity>();
    public ICollection<PhotoProcessingJob> ProcessingJobs { get; set; } = new List<PhotoProcessingJob>();
}
