namespace StudioManagement.Business.Leads;

public class LeadDto
{
    public int LeadId { get; set; }
    public string FullName { get; set; } = null!;
    public string MobileNumber { get; set; } = null!;
    public string? Email { get; set; }
    public int? EventTypeId { get; set; }
    public string? EventTypeName { get; set; }
    public int? LeadSourceId { get; set; }
    public string? LeadSourceName { get; set; }
    public int? LeadStatusId { get; set; }
    public string? LeadStatusName { get; set; }
    public DateTime? ExpectedEventDate { get; set; }
    public decimal? ExpectedBudget { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public DateTime? FollowUpDate { get; set; }
    public int? ConvertedCustomerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateLeadRequestDto
{
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
}

public class UpdateLeadRequestDto
{
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
}
