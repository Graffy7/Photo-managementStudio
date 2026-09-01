using StudioManagement.Business.Events;

namespace StudioManagement.Business.DayBoard;

public class DayBoardEventDto
{
    public int EventId { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? Venue { get; set; }
    public string? VenueAddress { get; set; }
    public string CustomerName { get; set; } = null!;
    public string CustomerMobileNumber { get; set; } = null!;
    public string? EventTypeName { get; set; }
    public string EventStatus { get; set; } = null!;
    public decimal? Budget { get; set; }
    public string? Notes { get; set; }
    public List<AssignedWorkerDto> Workers { get; set; } = [];
}

public class DayBoardDto
{
    public DateTime Date { get; set; }
    public List<DayBoardEventDto> Events { get; set; } = [];
}
