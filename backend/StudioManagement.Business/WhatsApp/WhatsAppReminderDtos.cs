namespace StudioManagement.Business.WhatsApp;

public class WhatsAppRunResult
{
    public int Sent { get; set; }
    public int Failed { get; set; }
    public int Skipped { get; set; }

    public void Add(WhatsAppRunResult other)
    {
        Sent += other.Sent;
        Failed += other.Failed;
        Skipped += other.Skipped;
    }
}

public class ReminderRecipientDto
{
    public string Name { get; set; } = null!;

    // "Owner" or "Worker".
    public string Kind { get; set; } = null!;
    public string? Phone { get; set; }
    public int EventCount { get; set; }

    // Whether a real run would deliver this message to them right now, and if not, why.
    public bool WillReceive { get; set; }
    public string? Note { get; set; }
}

public class ReminderMessagePreviewDto
{
    public string Title { get; set; } = null!;
    public string Text { get; set; } = null!;
    public List<ReminderRecipientDto> Recipients { get; set; } = [];
}

// The "does the privacy rule hold" checks, computed by the server from the messages it just built.
public class ReminderChecksDto
{
    public bool EventMessageHasNoPaymentInfo { get; set; }
    public bool PaymentMessageIsOwnerOnly { get; set; }
    public int WorkersReceivingPaymentMessage { get; set; }
}

public class ReminderPreviewDto
{
    public bool IsTest { get; set; } = true;
    public DateTime Date { get; set; }
    public int EventCount { get; set; }
    public string Provider { get; set; } = null!;
    public List<string> Warnings { get; set; } = [];
    public ReminderMessagePreviewDto EventMessage { get; set; } = null!;
    public ReminderMessagePreviewDto PaymentMessage { get; set; } = null!;
    public ReminderChecksDto Checks { get; set; } = new();

    // Only filled when the owner asked for the two test messages to be sent to their own phone.
    public List<string> SendResults { get; set; } = [];
}

public class TestReminderRequestDto
{
    // Preview a specific event as if it were tomorrow. Omit to use tomorrow's real events.
    public int? EventId { get; set; }

    // Also send the two TEST messages — to the studio owner's phone ONLY, never to a worker.
    public bool SendToOwner { get; set; }
}
