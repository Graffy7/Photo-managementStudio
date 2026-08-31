namespace StudioManagement.Data.Entities;

public class Expense : ITenantEntity
{
    public int ExpenseId { get; set; }
    public int StudioId { get; set; }
    public int ExpenseCategoryId { get; set; }
    public int? EventId { get; set; }
    public int? WorkerId { get; set; }
    public DateTime ExpenseDate { get; set; }
    public decimal Amount { get; set; }
    public string? Description { get; set; }
    public string? PaymentMethod { get; set; }
    public string? ReferenceNumber { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = null!;

    public Studio Studio { get; set; } = null!;
    public ExpenseCategory ExpenseCategory { get; set; } = null!;
    public Event? Event { get; set; }
    public Worker? Worker { get; set; }
}
