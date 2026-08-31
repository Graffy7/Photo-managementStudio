namespace StudioManagement.Data.Entities;

public class Lead : ITenantEntity
{
    public int LeadId { get; set; }
    public int StudioId { get; set; }
    public string FullName { get; set; } = null!;
    public string MobileNumber { get; set; } = null!;
    public string? Email { get; set; }
    public int? EventTypeId { get; set; }
    public int? LeadSourceId { get; set; }
    public int? LeadStatusId { get; set; }
    public DateTime? ExpectedEventDate { get; set; }
    public decimal? ExpectedBudget { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public DateTime? FollowUpDate { get; set; }
    public int? ConvertedCustomerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public EventType? EventType { get; set; }
    public LeadSource? LeadSource { get; set; }
    public LeadStatus? LeadStatus { get; set; }
    public Customer? ConvertedCustomer { get; set; }
}
