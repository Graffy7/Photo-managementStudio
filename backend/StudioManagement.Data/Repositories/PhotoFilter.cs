namespace StudioManagement.Data.Repositories;

public enum PhotoFilter
{
    All,
    Selected,
    NotSelected,
    Normal,
    Big
}

// A photo joined to its (optional) selection — what every gallery page and export needs.
// One gallery's link/cleanup state, for the platform storage report.
public record GalleryStorageRow(int GalleryId, int StudioId, string? SourceFolder, bool IsLinkActive, DateTime? LinkGeneratedAt,
    DateTime? ExpiresAt, DateTime? PreviewsPurgedAt);

public class PhotoWithSelection
{
    public Entities.Photo Photo { get; set; } = null!;
    public int? SelectionType { get; set; }
    public DateTime? SelectedAt { get; set; }
}

public record GallerySelectionCounts(int Total, int Normal, int Big)
{
    public int Selected => Normal + Big;
    public int NotSelected => Total - Selected;
}
