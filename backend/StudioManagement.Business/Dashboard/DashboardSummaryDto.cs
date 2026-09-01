namespace StudioManagement.Business.Dashboard;

public class PlanDistributionDto
{
    public string PlanName { get; set; } = null!;
    public int StudioCount { get; set; }
}

public class DashboardSummaryDto
{
    public int TotalStudios { get; set; }
    public int ActiveStudios { get; set; }
    public int BlockedStudios { get; set; }
    public int NewStudiosThisMonth { get; set; }
    public int ExpiredSubscriptions { get; set; }
    public int ExpiringSoon { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal RevenueThisMonth { get; set; }
    public List<PlanDistributionDto> PlanDistribution { get; set; } = [];
}
