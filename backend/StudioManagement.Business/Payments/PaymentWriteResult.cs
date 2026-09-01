namespace StudioManagement.Business.Payments;

public enum PaymentWriteFailureReason
{
    CustomerNotFound,
    EventNotFound
}

public class PaymentWriteResult
{
    public bool Succeeded { get; private init; }
    public PaymentWriteFailureReason? FailureReason { get; private init; }
    public PaymentDto? Payment { get; private init; }

    public static PaymentWriteResult Success(PaymentDto dto) => new() { Succeeded = true, Payment = dto };
    public static PaymentWriteResult Fail(PaymentWriteFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
