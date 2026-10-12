namespace StudioManagement.Business.Dashboard;

public class StudioDashboardSummaryDto
{
    public DateTime RangeStart { get; set; }
    public DateTime RangeEnd { get; set; }

    public int TotalLeads { get; set; }
    public int NewLeads { get; set; }
    public int ConvertedLeads { get; set; }
    public decimal ConversionRate { get; set; }

    public int TotalCustomers { get; set; }

    public int TotalEvents { get; set; }
    public int UpcomingEvents { get; set; }
    public int CompletedEvents { get; set; }
    public int CancelledEvents { get; set; }

    public decimal QuotationValue { get; set; }
    public decimal CollectedRevenue { get; set; }
    public decimal OutstandingBalance { get; set; }
    public decimal TotalExpenses { get; set; }
    // TotalExpenses split by whether the studio has paid them yet.
    public decimal PaidExpenses { get; set; }
    public decimal PendingExpenses { get; set; }
    public decimal ExpectedProfit { get; set; }
    public decimal CashProfit { get; set; }

    // Null means there's no previous-period baseline to compare against (e.g. the studio had
    // zero of something last period), not that the change is zero.
    public decimal? LeadsChangePercent { get; set; }
    public decimal? CustomersChangePercent { get; set; }
    public decimal? EventsChangePercent { get; set; }
    public decimal? RevenueChangePercent { get; set; }

    // What the range's events are worth in total: their agreed prices added up (cancelled left out).
    public decimal TotalEventValue { get; set; }
    public List<TopServiceDto> TopServices { get; set; } = [];
    public List<RevenueTrendPointDto> RevenueTrend { get; set; } = [];
}

public class TopServiceDto
{
    public string ServiceName { get; set; } = null!;
    public int UsageCount { get; set; }
    public decimal Percentage { get; set; }
}

// What one event contributed to a day's revenue. EventId is null for a payment not linked to an event.
public class RevenueTrendEventDto
{
    public int? EventId { get; set; }
    public string EventName { get; set; } = null!;
    public string CustomerName { get; set; } = null!;
    public string? Venue { get; set; }
    public decimal Amount { get; set; }
}

public class RevenueTrendPointDto
{
    public DateTime Date { get; set; }
    public decimal Amount { get; set; }

    // Which events the day's revenue came from, largest first — shown when hovering the chart. Only
    // the ones the tooltip shows are sent; MoreEvents says how many others there were that day.
    public List<RevenueTrendEventDto> Events { get; set; } = [];
    public int MoreEvents { get; set; }
}
