namespace StudioManagement.Business.Leads;

public enum LeadConversionFailureReason
{
    NotFound,
    AlreadyConverted
}

public class LeadConversionResult
{
    public bool Succeeded { get; private init; }
    public LeadConversionFailureReason? FailureReason { get; private init; }
    public LeadDto? Lead { get; private init; }
    public int? CustomerId { get; private init; }

    public static LeadConversionResult Success(LeadDto lead, int customerId) => new() { Succeeded = true, Lead = lead, CustomerId = customerId };
    public static LeadConversionResult Fail(LeadConversionFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
