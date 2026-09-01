namespace StudioManagement.Business.Quotations;

public enum QuotationWriteFailureReason
{
    CustomerNotFound,
    EventNotFound,
    ServiceNotFound
}

public class QuotationWriteResult
{
    public bool Succeeded { get; private init; }
    public QuotationWriteFailureReason? FailureReason { get; private init; }
    public QuotationDto? Quotation { get; private init; }

    public static QuotationWriteResult Success(QuotationDto dto) => new() { Succeeded = true, Quotation = dto };
    public static QuotationWriteResult Fail(QuotationWriteFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
