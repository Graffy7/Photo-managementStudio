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

// A gallery whose link was never sent but still has preview files, with every timestamp that counts as
// "activity" (cleanup only removes previews once all of them are older than the retention period).
public record UnsentGalleryRow(int GalleryId, int StudioId, int EventId, DateTime CreatedAt, DateTime UpdatedAt,
    DateTime? LastJobAt, DateTime? LastPhotoAt, bool ImportInProgress);

// Where one imported photo's original lives (folder + path inside it), for duplicate-import checks.
public record PhotoSourceEntry(int PhotoId, int GalleryId, int EventId, string? SourceFolder, string RelativePath, long? FileSize);

// An import job that is waiting or running, and the folder it reads.
public record ActiveImportJob(int GalleryId, int EventId, string SourceFolder);

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
