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
