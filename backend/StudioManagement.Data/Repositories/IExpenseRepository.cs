using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IExpenseRepository
{
    Task<Expense?> GetByIdAsync(int studioId, int expenseId, CancellationToken ct = default);
    Task<(List<Expense> Items, int TotalCount)> SearchAsync(int studioId, string? search, int? expenseCategoryId, int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Expense expense, CancellationToken ct = default);
    void Update(Expense expense);
    void Remove(Expense expense);
}
