namespace StudioManagement.Data.Entities;

public class Photo
{
    public int PhotoId { get; set; }
    public int PhotoGalleryId { get; set; }

    // The delivery folder this photo belongs to. Null means unfiled - photos imported before
    // folders existed, or ones that sat loose in the root of the source folder.
    public int? PhotoFolderId { get; set; }

    public int PhotoNumber { get; set; }
    public string FileName { get; set; } = null!;

    // The folder this photo was imported from. Null on photos imported before this was recorded, which
    // fall back to the gallery's SourceFolder.
    public string? SourceFolder { get; set; }

    // Path of the original relative to SourceFolder.
    public string SourceRelativePath { get; set; } = null!;

    // Null once previews have been purged after the gallery expired; the row and any selection stay.
    public string? ThumbnailPath { get; set; }
    public string? PreviewPath { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public PhotoGallery Gallery { get; set; } = null!;
    public PhotoFolder? Folder { get; set; }
    public PhotoSelection? Selection { get; set; }
}
