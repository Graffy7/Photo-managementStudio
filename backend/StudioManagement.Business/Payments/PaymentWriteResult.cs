namespace StudioManagement.Business.Payments;

public enum PaymentWriteFailureReason
{
    CustomerNotFound,
    EventNotFound,
    // The amount breaks a money rule (over the balance, deduction over what's paid, no reason...);
    // Message says which, in plain words.
    AmountNotAllowed
}

public class PaymentWriteResult
{
    public bool Succeeded { get; private init; }
    public PaymentWriteFailureReason? FailureReason { get; private init; }
    public PaymentDto? Payment { get; private init; }
    public string? Message { get; private init; }

    public static PaymentWriteResult Success(PaymentDto dto) => new() { Succeeded = true, Payment = dto };
    public static PaymentWriteResult Fail(PaymentWriteFailureReason reason, string? message = null) => new() { Succeeded = false, FailureReason = reason, Message = message };
}
