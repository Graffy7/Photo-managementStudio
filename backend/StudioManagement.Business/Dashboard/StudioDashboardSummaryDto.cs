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
    public decimal ExpectedProfit { get; set; }
    public decimal CashProfit { get; set; }

    // Null means there's no previous-period baseline to compare against (e.g. the studio had
    // zero of something last period), not that the change is zero.
    public decimal? LeadsChangePercent { get; set; }
    public decimal? CustomersChangePercent { get; set; }
    public decimal? EventsChangePercent { get; set; }
    public decimal? RevenueChangePercent { get; set; }

    public List<TopServiceDto> TopServices { get; set; } = [];
    public List<RevenueTrendPointDto> RevenueTrend { get; set; } = [];
}

public class TopServiceDto
{
    public string ServiceName { get; set; } = null!;
    public int UsageCount { get; set; }
    public decimal Percentage { get; set; }
}

public class RevenueTrendPointDto
{
    public DateTime Date { get; set; }
    public decimal Amount { get; set; }
}
