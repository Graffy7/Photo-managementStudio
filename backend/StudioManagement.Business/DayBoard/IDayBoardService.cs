namespace StudioManagement.Business.DayBoard;

public interface IDayBoardService
{
    Task<DayBoardDto> GetDayBoardAsync(int studioId, DateTime date, CancellationToken ct = default);
}
