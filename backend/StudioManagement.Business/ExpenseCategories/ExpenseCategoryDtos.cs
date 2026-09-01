namespace StudioManagement.Business.ExpenseCategories;

public class ExpenseCategoryDto
{
    public int ExpenseCategoryId { get; set; }
    public string CategoryName { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateExpenseCategoryRequestDto
{
    public string CategoryName { get; set; } = null!;
    public string? Description { get; set; }
}

public class UpdateExpenseCategoryRequestDto
{
    public string CategoryName { get; set; } = null!;
    public string? Description { get; set; }
}
