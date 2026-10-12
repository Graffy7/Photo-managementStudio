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
    public string? VendorName { get; set; }
    // "Paid" or "Pending". Left out (older screens), the expense is recorded as Paid.
    public string? PaymentStatus { get; set; }
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
    public string? VendorName { get; set; }
    // "Paid" or "Pending". Left out (older screens), the expense is recorded as Paid.
    public string? PaymentStatus { get; set; }
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
    public string? VendorName { get; set; }
    // "Paid" or "Pending". Left out (older screens), the expense is recorded as Paid.
    public string? PaymentStatus { get; set; }
}

// An event's money picture: what was agreed, what it cost, what is left - and separately what the
// customer still owes and what the studio still owes. Customer payments are only ever counted in
// AmountReceived / OutstandingBalance; profit is worked out on the agreed price, not on payments.
public class EventExpenseSummaryDto
{
    public int EventId { get; set; }
    public decimal TotalEventAmount { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal PaidExpenses { get; set; }
    public decimal PendingExpenses { get; set; }
    public decimal NetProfit { get; set; }
    public decimal? ProfitMarginPercent { get; set; }
    public decimal AmountReceived { get; set; }
    public decimal OutstandingBalance { get; set; }
    public List<ExpenseDto> Expenses { get; set; } = [];
}
