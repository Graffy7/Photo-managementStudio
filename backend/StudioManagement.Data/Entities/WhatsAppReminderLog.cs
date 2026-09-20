namespace StudioManagement.Data.Entities;

// One row per (event, day, message kind, recipient): the record that stops a reminder being sent
// twice, and what an owner can look at to see who got what. Message 1 (event/worker) and message 2
// (payment, owner only) are separate kinds, tracked and retried independently.
public class WhatsAppReminderLog : ITenantEntity
{
    public int WhatsAppReminderLogId { get; set; }
    public int StudioId { get; set; }
    public int EventId { get; set; }

    // The day the reminder is FOR (the event day), not the day it was sent.
    public DateTime ReminderDate { get; set; }

    // TomorrowEvent | TomorrowPayment
    public string ReminderType { get; set; } = null!;

    // Owner | Worker
    public string RecipientType { get; set; } = null!;
    public int? WorkerId { get; set; }

    // "owner" or "worker:<id>" — what the uniqueness is enforced on.
    public string RecipientKey { get; set; } = null!;

    // Sent | Failed | Skipped
    public string Status { get; set; } = null!;
    public int Attempts { get; set; }
    public string? Detail { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public Event Event { get; set; } = null!;
}
