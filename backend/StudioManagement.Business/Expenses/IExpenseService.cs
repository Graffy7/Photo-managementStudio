using StudioManagement.Business.Common;

namespace StudioManagement.Business.Expenses;

public interface IExpenseService
{
    Task<PagedResult<ExpenseDto>> SearchAsync(int studioId, string? search, int? expenseCategoryId, int page, int pageSize, CancellationToken ct = default);
    Task<ExpenseDto?> GetByIdAsync(int studioId, int expenseId, CancellationToken ct = default);
    // The event's expenses with its profit figures; null when the event isn't this studio's.
    Task<EventExpenseSummaryDto?> GetEventSummaryAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<ExpenseWriteResult> CreateAsync(int studioId, CreateExpenseRequestDto request, CancellationToken ct = default);
    Task<ExpenseWriteResult?> UpdateAsync(int studioId, int expenseId, UpdateExpenseRequestDto request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int studioId, int expenseId, CancellationToken ct = default);
}
