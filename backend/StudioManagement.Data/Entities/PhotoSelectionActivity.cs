namespace StudioManagement.Data.Entities;

public class PhotoSelectionActivity
{
    public int PhotoSelectionActivityId { get; set; }
    public int PhotoSelectionProjectId { get; set; }
    public int? PhotoId { get; set; }
    public string Action { get; set; } = null!;
    public string? OldSelectionType { get; set; }
    public string? NewSelectionType { get; set; }
    public DateTime CreatedAt { get; set; }

    public PhotoSelectionProject SelectionProject { get; set; } = null!;
    public Photo? Photo { get; set; }
}
