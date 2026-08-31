namespace StudioManagement.Data.Entities;

public class ExpenseCategory : ITenantEntity
{
    public int ExpenseCategoryId { get; set; }
    public int StudioId { get; set; }
    public string CategoryName { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
}
