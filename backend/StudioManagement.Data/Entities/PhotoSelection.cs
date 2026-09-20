namespace StudioManagement.Data.Entities;

// At most one row per photo (unique index on PhotoId). A photo that isn't selected has no row at
// all, so Normal + Big always equals Total Selected and an unselected photo can't keep a stale size.
public class PhotoSelection
{
    public int PhotoSelectionId { get; set; }
    public int PhotoGalleryId { get; set; }
    public int PhotoId { get; set; }
    public int SelectionType { get; set; }
    public DateTime SelectedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public PhotoGallery Gallery { get; set; } = null!;
    public Photo Photo { get; set; } = null!;
}
