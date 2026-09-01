namespace StudioManagement.Business.ExpenseCategories;

public interface IExpenseCategoryService
{
    Task<List<ExpenseCategoryDto>> GetAllAsync(int studioId, CancellationToken ct = default);
    Task<ExpenseCategoryResult> CreateAsync(int studioId, CreateExpenseCategoryRequestDto request, CancellationToken ct = default);
    Task<ExpenseCategoryResult> UpdateAsync(int studioId, int expenseCategoryId, UpdateExpenseCategoryRequestDto request, CancellationToken ct = default);
    Task<ExpenseCategoryResult> SetActiveAsync(int studioId, int expenseCategoryId, bool isActive, CancellationToken ct = default);
}
