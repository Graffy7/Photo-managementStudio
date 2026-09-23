namespace StudioManagement.Data.Entities;

// One line of a completed event's delivery checklist ("Album delivered", "Pendrive delivered", ...).
// The three standard items carry an ItemKey; anything the studio adds itself has ItemKey null, which
// is what makes a custom item removable without touching the standard ones.
public class EventDeliveryItem : ITenantEntity
{
    public int EventDeliveryItemId { get; set; }
    public int StudioId { get; set; }
    public int EventId { get; set; }

    // "Album" / "Video" / "Photos" for the standard items, null for one the studio added.
    public string? ItemKey { get; set; }
    public string Name { get; set; } = null!;
    public bool IsDelivered { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public Event Event { get; set; } = null!;
}
