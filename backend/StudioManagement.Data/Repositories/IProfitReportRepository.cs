namespace StudioManagement.Data.Repositories;

public class EventProfitRow
{
    public int EventId { get; set; }
    public DateTime EventDate { get; set; }
    public string? Venue { get; set; }
    public string CustomerName { get; set; } = null!;
    public decimal QuotationValue { get; set; }
    public decimal CollectedRevenue { get; set; }
    public decimal Expenses { get; set; }
}

public class ExpenseCategoryBreakdownRow
{
    public string CategoryName { get; set; } = null!;
    public decimal TotalAmount { get; set; }
}

public interface IProfitReportRepository
{
    Task<List<EventProfitRow>> GetEventBreakdownAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
    Task<List<ExpenseCategoryBreakdownRow>> GetExpenseBreakdownByCategoryAsync(int studioId, DateTime start, DateTime end, CancellationToken ct = default);
}
