namespace StudioManagement.Business.Expenses;

public enum ExpenseWriteFailureReason
{
    CategoryNotFound,
    EventNotFound,
    WorkerNotFound
}

public class ExpenseWriteResult
{
    public bool Succeeded { get; private init; }
    public ExpenseWriteFailureReason? FailureReason { get; private init; }
    public ExpenseDto? Expense { get; private init; }

    public static ExpenseWriteResult Success(ExpenseDto dto) => new() { Succeeded = true, Expense = dto };
    public static ExpenseWriteResult Fail(ExpenseWriteFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
