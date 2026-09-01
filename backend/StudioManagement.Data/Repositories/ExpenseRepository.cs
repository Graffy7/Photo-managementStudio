using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class ExpenseRepository(AppDbContext context) : IExpenseRepository
{
    public Task<Expense?> GetByIdAsync(int studioId, int expenseId, CancellationToken ct = default) =>
        context.Expenses
            .Include(e => e.ExpenseCategory)
            .Include(e => e.Event)
            .Include(e => e.Worker)
            .FirstOrDefaultAsync(e => e.StudioId == studioId && e.ExpenseId == expenseId, ct);

    public async Task<(List<Expense> Items, int TotalCount)> SearchAsync(int studioId, string? search, int? expenseCategoryId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Expenses
            .AsNoTracking()
            .Include(e => e.ExpenseCategory)
            .Include(e => e.Event)
            .Include(e => e.Worker)
            .Where(e => e.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(e => (e.Description != null && e.Description.Contains(term)) || (e.ReferenceNumber != null && e.ReferenceNumber.Contains(term)));
        }

        if (expenseCategoryId is not null)
        {
            query = query.Where(e => e.ExpenseCategoryId == expenseCategoryId);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(e => e.ExpenseDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task AddAsync(Expense expense, CancellationToken ct = default) =>
        await context.Expenses.AddAsync(expense, ct);

    public void Update(Expense expense) => context.Expenses.Update(expense);

    public void Remove(Expense expense) => context.Expenses.Remove(expense);
}
