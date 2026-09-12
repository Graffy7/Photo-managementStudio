namespace StudioManagement.Data.Entities;

public class Photo
{
    public int PhotoId { get; set; }
    public int PhotoSelectionProjectId { get; set; }
    public int PhotoNumber { get; set; }

    // The original file's name/relative location on the studio's own storage — reference only,
    // the bytes themselves are never uploaded or stored here.
    public string OriginalFileName { get; set; } = null!;
    public string RelativePath { get; set; } = null!;

    public string ThumbnailPath { get; set; } = null!;
    public string PreviewPath { get; set; } = null!;

    public string SelectionType { get; set; } = null!;
    public bool IsSelected { get; set; }
    public DateTime? SelectedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public PhotoSelectionProject SelectionProject { get; set; } = null!;
}
