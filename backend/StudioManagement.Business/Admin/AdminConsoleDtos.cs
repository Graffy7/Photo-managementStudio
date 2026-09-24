namespace StudioManagement.Business.Admin;

// A studio's standing as the platform admin sees it.
public static class AdminStudioStatuses
{
    public const string Active = "Active";       // paid subscription running
    public const string Trial = "Trial";         // free trial running
    public const string Expired = "Expired";     // subscription or trial ran out
    public const string NoPlan = "NoPlan";       // never had a subscription
    public const string Blocked = "Blocked";
    public const string Inactive = "Inactive";

    public static readonly string[] All = [Active, Trial, Expired, NoPlan, Blocked, Inactive];
}

public class MonthValueDto
{
    public string Month { get; set; } = null!;   // yyyy-MM
    public decimal Value { get; set; }
}

public class StudioStorageDto
{
    public int StudioId { get; set; }
    public string StudioName { get; set; } = null!;
    public long OriginalBytes { get; set; }
    public long PreviewBytes { get; set; }
    public long ThumbnailBytes { get; set; }

    // What the app itself stores (previews + thumbnails). Originals stay on the studio's own disk.
    public long AppBytes => PreviewBytes + ThumbnailBytes;
    public int PhotoCount { get; set; }
    public int MissingOriginals { get; set; }
}

public class AdminOverviewDto
{
    public int TotalStudios { get; set; }
    public int ActiveSubscriptions { get; set; }
    public int ActiveTrials { get; set; }
    public int Expired { get; set; }
    public int Blocked { get; set; }
    public int ExpiringIn7Days { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal RangeRevenue { get; set; }
    public long AppStorageBytes { get; set; }
    public long OriginalStorageBytes { get; set; }
    public DateTime RangeStart { get; set; }
    public DateTime RangeEnd { get; set; }
    public List<MonthValueDto> RevenueByMonth { get; set; } = [];
    public List<MonthValueDto> NewStudiosByMonth { get; set; } = [];
    public Dictionary<string, int> StatusBreakdown { get; set; } = [];
    public List<StudioStorageDto> StorageByStudio { get; set; } = [];
}

public class AdminStudioRowDto
{
    public int StudioId { get; set; }
    public string StudioName { get; set; } = null!;
    public string? OwnerName { get; set; }
    public string? OwnerEmail { get; set; }
    public string? PhoneNumber { get; set; }
    public string Status { get; set; } = null!;
    public bool IsActive { get; set; }
    public bool IsBlocked { get; set; }
    public string? PlanName { get; set; }
    public bool IsTrial { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int DaysRemaining { get; set; }
    public int MonthsSubscribed { get; set; }
    public decimal TotalPaid { get; set; }
    public int PaymentCount { get; set; }
    public long AppStorageBytes { get; set; }
    public long OriginalStorageBytes { get; set; }
    public DateTime? LastActiveAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UsagePeriodDto
{
    public int TodayMinutes { get; set; }
    public int Last7DaysMinutes { get; set; }
    public int Last30DaysMinutes { get; set; }
    public int ActiveDaysLast30 { get; set; }
}

public class AdminStudioDetailDto
{
    public AdminStudioRowDto Studio { get; set; } = null!;
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? LoginEmail { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public int? SubscriptionPlanId { get; set; }
    public decimal? PlanPrice { get; set; }
    public int? PlanDurationDays { get; set; }
    public UsagePeriodDto Usage { get; set; } = new();
}

public class DailyUsageDto
{
    public DateTime Date { get; set; }
    public int ActiveMinutes { get; set; }
    public int Requests { get; set; }
}

public class FeatureUsageDto
{
    public string Name { get; set; } = null!;
    public int Count { get; set; }
}

public class AdminStudioUsageDto
{
    public StudioStorageDto Storage { get; set; } = null!;
    public Dictionary<string, int> Records { get; set; } = [];
    public List<FeatureUsageDto> FeatureUsage { get; set; } = [];
    public List<DailyUsageDto> Daily { get; set; } = [];
    public DateTime? LastActivityAt { get; set; }
    public DateTime? StorageMeasuredAt { get; set; }
}

public class AdminActivityDto
{
    public long Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? StudioId { get; set; }
    public string? StudioName { get; set; }
    public string Module { get; set; } = null!;
    public string Action { get; set; } = null!;
    public string? UserName { get; set; }
    public string? UserType { get; set; }
    public string? IpAddress { get; set; }
    public string? Device { get; set; }
}

public class AdminPaymentDto
{
    public int PaymentId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public string? PlanName { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public int Months { get; set; }
}

public class AdminSubscriptionDto
{
    public string Status { get; set; } = null!;
    public bool IsTrial { get; set; }
    public int? SubscriptionPlanId { get; set; }
    public string? PlanName { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int DaysRemaining { get; set; }
    public int MonthsPurchased { get; set; }
    public int PaymentCount { get; set; }
    public decimal TotalPaid { get; set; }
    public List<AdminPaymentDto> Payments { get; set; } = [];
}

// ---- Requests ----------------------------------------------------------------------------------

public class TrialDaysRequestDto
{
    public int Days { get; set; }
}

// Records a subscription payment. Months > 0 also extends the subscription by that many months
// (a running trial becomes a paid subscription starting today); 0 just records the money.
public class ManualPaymentRequestDto
{
    public int? SubscriptionPlanId { get; set; }
    public int Months { get; set; }
    public decimal Amount { get; set; }
    public DateTime? PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = null!;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
}
