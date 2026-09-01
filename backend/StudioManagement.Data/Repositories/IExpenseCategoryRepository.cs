using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IExpenseCategoryRepository
{
    Task<ExpenseCategory?> GetByIdAsync(int studioId, int expenseCategoryId, CancellationToken ct = default);
    Task<List<ExpenseCategory>> GetAllAsync(int studioId, CancellationToken ct = default);
    Task AddAsync(ExpenseCategory category, CancellationToken ct = default);
    void Update(ExpenseCategory category);
}
