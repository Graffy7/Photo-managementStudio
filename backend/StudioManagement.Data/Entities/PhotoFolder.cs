namespace StudioManagement.Data.Entities;

// A delivery folder inside one event's gallery ("Candid Photos", "Reception", "Drone"...). Folders
// group photos that already exist - they never hold the images themselves, so deleting a folder
// only unfiles its photos and leaves the originals, previews and selections alone.
public class PhotoFolder : ITenantEntity
{
    public int PhotoFolderId { get; set; }
    public int StudioId { get; set; }
    public int PhotoGalleryId { get; set; }

    public string Name { get; set; } = null!;
    public int SortOrder { get; set; }

    // Whether this folder has been handed over to the customer.
    public bool IsDelivered { get; set; }
    public DateTime? DeliveredAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public PhotoGallery Gallery { get; set; } = null!;
    public ICollection<Photo> Photos { get; set; } = new List<Photo>();
}
