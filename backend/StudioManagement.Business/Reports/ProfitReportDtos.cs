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

    // Profit on the agreed price of the event: EventTotal - Expenses, whether or not the customer
    // has paid yet. What the customer still owes and what the studio still owes are shown apart.
    public decimal EventTotal { get; set; }
    public decimal PaidExpenses { get; set; }
    public decimal PendingExpenses { get; set; }
    public decimal NetProfit { get; set; }
    // Null when the event has no agreed price to take a percentage of.
    public decimal? ProfitMarginPercent { get; set; }
    public decimal OutstandingBalance { get; set; }
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

    // Totals of the events listed below (events dated in the range), on their agreed prices.
    public decimal EventsTotalAmount { get; set; }
    public decimal EventsExpenses { get; set; }
    public decimal EventsPendingExpenses { get; set; }
    public decimal EventsNetProfit { get; set; }
    public decimal EventsOutstandingBalance { get; set; }

    // Events falling in the range, with their full linked economics regardless of when the
    // quotation/payment/expense itself was recorded — unlike the totals above, which are filtered
    // by each transaction's own date to match the studio dashboard.
    public List<EventProfitDto> Events { get; set; } = [];
    public List<ExpenseCategoryBreakdownDto> ExpensesByCategory { get; set; } = [];
}
