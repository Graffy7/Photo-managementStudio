namespace StudioManagement.Business.Reports;

public class EventProfitDto
{
    public int EventId { get; set; }
    public DateTime EventDate { get; set; }
    public string? Venue { get; set; }
    public string CustomerName { get; set; } = null!;
    public decimal QuotationValue { get; set; }
    public decimal CollectedRevenue { get; set; }
    public decimal Expenses { get; set; }
    public decimal ExpectedProfit { get; set; }
    public decimal CashProfit { get; set; }
}

public class ExpenseCategoryBreakdownDto
{
    public string CategoryName { get; set; } = null!;
    public decimal TotalAmount { get; set; }
}

public class ProfitReportDto
{
    public DateTime RangeStart { get; set; }
    public DateTime RangeEnd { get; set; }

    public decimal TotalQuotationValue { get; set; }
    public decimal TotalCollectedRevenue { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal TotalExpectedProfit { get; set; }
    public decimal TotalCashProfit { get; set; }

    // Events falling in the range, with their full linked economics regardless of when the
    // quotation/payment/expense itself was recorded — unlike the totals above, which are filtered
    // by each transaction's own date to match the studio dashboard.
    public List<EventProfitDto> Events { get; set; } = [];
    public List<ExpenseCategoryBreakdownDto> ExpensesByCategory { get; set; } = [];
}
