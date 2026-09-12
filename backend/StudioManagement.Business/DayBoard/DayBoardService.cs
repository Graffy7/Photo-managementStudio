using System.Globalization;
using StudioManagement.Business.Events;
using StudioManagement.Data.Common;
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

    public async Task<List<MonthEventsDto>> GetMonthAsync(int studioId, int year, int month, CancellationToken ct = default)
    {
        var monthStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);

        var events = await eventRepository.GetForDayAsync(studioId, monthStart, monthEnd, ct);

        return events
            .GroupBy(e => e.EventDate.Date)
            .Select(g => new MonthEventsDto
            {
                Date = g.Key,
                Events = g.Select(MapToDto).ToList()
            })
            .OrderBy(d => d.Date)
            .ToList();
    }

    private static DayBoardEventDto MapToDto(Event @event)
    {
        var amountPaid = @event.Payments.Where(p => p.PaymentStatus == PaymentStatuses.Completed).Sum(p => p.Amount);

        return new DayBoardEventDto
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
            AmountPaid = amountPaid,
            Balance = (@event.Budget ?? 0) - amountPaid,
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
}
