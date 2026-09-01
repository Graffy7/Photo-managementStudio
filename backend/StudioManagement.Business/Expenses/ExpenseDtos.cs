namespace StudioManagement.Business.Expenses;

public class ExpenseDto
{
    public int ExpenseId { get; set; }
    public int ExpenseCategoryId { get; set; }
    public string ExpenseCategoryName { get; set; } = null!;
    public int? EventId { get; set; }
    public string? EventVenue { get; set; }
    public int? WorkerId { get; set; }
    public string? WorkerName { get; set; }
    public DateTime ExpenseDate { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string? PaymentMethod { get; set; }
    public string? ReferenceNumber { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateExpenseRequestDto
{
    public int ExpenseCategoryId { get; set; }
    public int? EventId { get; set; }
    public int? WorkerId { get; set; }
    public DateTime ExpenseDate { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string? PaymentMethod { get; set; }
    public string? ReferenceNumber { get; set; }
}

public class UpdateExpenseRequestDto
{
    public int ExpenseCategoryId { get; set; }
    public int? EventId { get; set; }
    public int? WorkerId { get; set; }
    public DateTime ExpenseDate { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string? PaymentMethod { get; set; }
    public string? ReferenceNumber { get; set; }
}
