using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class ExpenseCategoryRepository(AppDbContext context) : IExpenseCategoryRepository
{
    public Task<ExpenseCategory?> GetByIdAsync(int studioId, int expenseCategoryId, CancellationToken ct = default) =>
        context.ExpenseCategories.FirstOrDefaultAsync(c => c.StudioId == studioId && c.ExpenseCategoryId == expenseCategoryId, ct);

    public Task<List<ExpenseCategory>> GetAllAsync(int studioId, CancellationToken ct = default) =>
        context.ExpenseCategories.AsNoTracking().Where(c => c.StudioId == studioId).ToListAsync(ct);

    public async Task AddAsync(ExpenseCategory category, CancellationToken ct = default) =>
        await context.ExpenseCategories.AddAsync(category, ct);

    public void Update(ExpenseCategory category) => context.ExpenseCategories.Update(category);
}
