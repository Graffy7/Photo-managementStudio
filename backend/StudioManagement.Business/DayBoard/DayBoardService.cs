using System.Globalization;
using StudioManagement.Business.Events;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.DayBoard;

public class DayBoardService(IEventRepository eventRepository) : IDayBoardService
{
    private const string TimeFormat = @"hh\:mm";

    public async Task<DayBoardDto> GetDayBoardAsync(int studioId, DateTime date, CancellationToken ct = default)
    {
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);

        var events = await eventRepository.GetForDayAsync(studioId, dayStart, dayEnd, ct);

        return new DayBoardDto
        {
            Date = dayStart,
            Events = events.Select(MapToDto).ToList()
        };
    }

    private static DayBoardEventDto MapToDto(Event @event) => new()
    {
        EventId = @event.EventId,
        StartTime = @event.StartTime?.ToString(TimeFormat, CultureInfo.InvariantCulture),
        EndTime = @event.EndTime?.ToString(TimeFormat, CultureInfo.InvariantCulture),
        Venue = @event.Venue,
        VenueAddress = @event.VenueAddress,
        CustomerName = @event.Customer.FullName,
        CustomerMobileNumber = @event.Customer.MobileNumber,
        EventTypeName = @event.EventType?.Name,
        EventStatus = @event.EventStatus,
        Budget = @event.Budget,
        Notes = @event.Notes,
        Workers = @event.EventWorkers.Select(ew => new AssignedWorkerDto
        {
            EventWorkerId = ew.EventWorkerId,
            WorkerId = ew.WorkerId,
            WorkerName = ew.Worker.FullName,
            WorkerMobileNumber = ew.Worker.MobileNumber,
            WorkerTypeName = ew.Worker.WorkerType?.Name,
            Notes = ew.Notes
        }).ToList()
    };
}
