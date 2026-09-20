namespace StudioManagement.Data.Entities;

// One selection gallery per event. Holds only metadata and the customer link's state — the
// original photos stay in the studio's own folder (SourceFolder) and are never copied or stored.
public class PhotoGallery : ITenantEntity
{
    public int PhotoGalleryId { get; set; }
    public int StudioId { get; set; }
    public int CustomerId { get; set; }
    public int EventId { get; set; }

    // Server-side only: where the originals live on the studio's machine. Never sent to customers.
    public string? SourceFolder { get; set; }

    // TokenHash is what the public link is looked up by. TokenProtected is the same token encrypted
    // at rest so the owner can copy/resend the link later without regenerating (and thereby
    // invalidating) it — the raw token itself is never stored.
    public string? TokenHash { get; set; }
    public string? TokenProtected { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsLinkActive { get; set; }
    public string Status { get; set; } = null!;

    public DateTime? LinkGeneratedAt { get; set; }
    public DateTime? FirstOpenedAt { get; set; }
    public DateTime? LastSelectionAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? PreviewsPurgedAt { get; set; }

    // Customer Selection folders: first created, and the moment of the latest sync (a customer change
    // after this means the folders are out of date).
    public DateTime? SelectionCreatedAt { get; set; }
    public DateTime? SelectionSyncedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public Event Event { get; set; } = null!;
    public ICollection<Photo> Photos { get; set; } = new List<Photo>();
}
