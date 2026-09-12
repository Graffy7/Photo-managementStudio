namespace StudioManagement.Business.Customers;

public class CustomerDto
{
    public int CustomerId { get; set; }
    public string FullName { get; set; } = null!;
    public string MobileNumber { get; set; } = null!;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateCustomerRequestDto
{
    public string FullName { get; set; } = null!;
    public string MobileNumber { get; set; } = null!;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
}

public class UpdateCustomerRequestDto
{
    public string FullName { get; set; } = null!;
    public string MobileNumber { get; set; } = null!;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
}

public class CustomerEventSummaryDto
{
    public int EventId { get; set; }
    public string? EventTypeName { get; set; }
    public DateTime EventDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? Venue { get; set; }
    public string? VenueAddress { get; set; }
    public string EventStatus { get; set; } = null!;
    public decimal? Budget { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal Balance { get; set; }
    public int WorkerCount { get; set; }
    public string? Notes { get; set; }
}
