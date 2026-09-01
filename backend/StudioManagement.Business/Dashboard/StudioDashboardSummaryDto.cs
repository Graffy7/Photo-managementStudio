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
}
