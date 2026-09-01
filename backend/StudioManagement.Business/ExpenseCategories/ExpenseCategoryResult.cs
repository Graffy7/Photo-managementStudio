namespace StudioManagement.Business.ExpenseCategories;

public enum ExpenseCategoryFailureReason
{
    DuplicateName,
    NotFound
}

public class ExpenseCategoryResult
{
    public bool Succeeded { get; private init; }
    public ExpenseCategoryFailureReason? FailureReason { get; private init; }
    public ExpenseCategoryDto? Category { get; private init; }

    public static ExpenseCategoryResult Success(ExpenseCategoryDto dto) => new() { Succeeded = true, Category = dto };
    public static ExpenseCategoryResult Fail(ExpenseCategoryFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}
