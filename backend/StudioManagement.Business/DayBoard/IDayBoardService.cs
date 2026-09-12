namespace StudioManagement.Business.DayBoard;

public interface IDayBoardService
{
    Task<DayBoardDto> GetDayBoardAsync(int studioId, DateTime date, CancellationToken ct = default);
    Task<List<MonthEventsDto>> GetMonthAsync(int studioId, int year, int month, CancellationToken ct = default);
}
