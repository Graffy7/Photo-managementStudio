namespace StudioManagement.Data.Entities;

// A file this system created in Customer Selection\Normal or \Big Size. It is the only kind of file a
// sync is ever allowed to delete — a file that merely happens to sit in those folders (put there by
// the owner, say) has no row here and is left alone.
public class PhotoSelectionCopy
{
    public int PhotoSelectionCopyId { get; set; }
    public int PhotoGalleryId { get; set; }
    public int PhotoId { get; set; }

    // 1 = Normal, 2 = Big Size — the folder the copy was written to.
    public int SelectionType { get; set; }

    // Full path of the generated copy on the studio's machine.
    public string DestinationPath { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public PhotoGallery Gallery { get; set; } = null!;
    public Photo Photo { get; set; } = null!;
}
