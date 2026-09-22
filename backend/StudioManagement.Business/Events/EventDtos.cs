namespace StudioManagement.Business.Events;

public class EventDto
{
    public int EventId { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public string CustomerMobileNumber { get; set; } = null!;
    public int? EventTypeId { get; set; }
    public string? EventTypeName { get; set; }
    public DateTime EventDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? Venue { get; set; }
    public string? VenueAddress { get; set; }
    public decimal? Budget { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal Balance { get; set; }
    public string EventStatus { get; set; } = null!;
    public string? FileLocation { get; set; }
    public string? Notes { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateEventRequestDto
{
    public int CustomerId { get; set; }
    public int? EventTypeId { get; set; }
    public DateTime EventDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? Venue { get; set; }
    public string? VenueAddress { get; set; }
    public decimal? Budget { get; set; }
    // Optional advance collected when the event is booked — recorded as a Completed payment
    // against the new event in the same save, so the event and its first payment can't drift apart.
    public decimal? AdvancePaid { get; set; }
    public string? AdvancePaymentMethod { get; set; }
    public string EventStatus { get; set; } = null!;
    public string? FileLocation { get; set; }
    public string? Notes { get; set; }
}

public class UpdateEventRequestDto
{
    public int CustomerId { get; set; }
    public int? EventTypeId { get; set; }
    public DateTime EventDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? Venue { get; set; }
    public string? VenueAddress { get; set; }
    public decimal? Budget { get; set; }
    public string EventStatus { get; set; } = null!;
    public string? FileLocation { get; set; }
    public string? Notes { get; set; }
}

public class UpdateEventNotesRequestDto
{
    public string? Notes { get; set; }
}

// ---- Event history -----------------------------------------------------------------------------
// The permanent record of one event: who it was for, who worked it, every quotation ever raised for
// it (including the superseded ones), and every payment. Read-only - nothing here writes.

public class EventHistoryQuotationDto
{
    public int QuotationId { get; set; }

    // "V1", "V2", ... in the order the quotations were raised for this event. Numbering is per
    // event, so another event's quotations never renumber this one's.
    public string Version { get; set; } = null!;
    public string QuotationNumber { get; set; } = null!;
    public DateTime QuotationDate { get; set; }
    public string Status { get; set; } = null!;
    public decimal GrandTotal { get; set; }
    public bool IsApproved { get; set; }
}

public class EventHistoryPaymentDto
{
    public int PaymentId { get; set; }
    public DateTime PaymentDate { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = null!;
    public string PaymentStatus { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
}

public class EventHistoryWorkerDto
{
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = null!;
    public string? WorkerTypeName { get; set; }
    public string? Role { get; set; }
}

public class EventHistoryDto
{
    public EventDto Event { get; set; } = null!;
    public List<EventHistoryWorkerDto> Workers { get; set; } = [];

    // Every quotation raised for this event, oldest first.
    public List<EventHistoryQuotationDto> Quotations { get; set; } = [];

    // The accepted one (the latest, if more than one was ever accepted), or null.
    public EventHistoryQuotationDto? ApprovedQuotation { get; set; }

    public List<EventHistoryPaymentDto> Payments { get; set; } = [];

    // The approved quotation's total when there is one, otherwise the event's own budget.
    public decimal? FinalAmount { get; set; }
}
