using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Expenses;

public class ExpenseService(
    IExpenseRepository expenseRepository,
    IExpenseCategoryRepository expenseCategoryRepository,
    IEventRepository eventRepository,
    IWorkerRepository workerRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IExpenseService
{
    private const string Module = "Expenses";

    public async Task<PagedResult<ExpenseDto>> SearchAsync(int studioId, string? search, int? expenseCategoryId, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await expenseRepository.SearchAsync(studioId, search, expenseCategoryId, page, pageSize, ct);
        return new PagedResult<ExpenseDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<ExpenseDto?> GetByIdAsync(int studioId, int expenseId, CancellationToken ct = default)
    {
        var expense = await expenseRepository.GetByIdAsync(studioId, expenseId, ct);
        return expense is null ? null : MapToDto(expense);
    }

    public async Task<ExpenseWriteResult> CreateAsync(int studioId, CreateExpenseRequestDto request, CancellationToken ct = default)
    {
        var failure = await ValidateReferencesAsync(studioId, request.ExpenseCategoryId, request.EventId, request.WorkerId, ct);
        if (failure is not null)
        {
            return ExpenseWriteResult.Fail(failure.Value);
        }

        var now = DateTime.UtcNow;
        var expense = new Expense
        {
            StudioId = studioId,
            ExpenseCategoryId = request.ExpenseCategoryId,
            EventId = request.EventId,
            WorkerId = request.WorkerId,
            ExpenseDate = request.ExpenseDate,
            Amount = request.Amount,
            Description = request.Description,
            PaymentMethod = request.PaymentMethod,
            ReferenceNumber = request.ReferenceNumber,
            CreatedAt = now,
            UpdatedAt = now
        };

        await expenseRepository.AddAsync(expense, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Expense recorded", Module, studioId, ct);

        var created = await expenseRepository.GetByIdAsync(studioId, expense.ExpenseId, ct);
        return ExpenseWriteResult.Success(MapToDto(created!));
    }

    public async Task<ExpenseWriteResult?> UpdateAsync(int studioId, int expenseId, UpdateExpenseRequestDto request, CancellationToken ct = default)
    {
        var expense = await expenseRepository.GetByIdAsync(studioId, expenseId, ct);
        if (expense is null)
        {
            return null;
        }

        var failure = await ValidateReferencesAsync(studioId, request.ExpenseCategoryId, request.EventId, request.WorkerId, ct);
        if (failure is not null)
        {
            return ExpenseWriteResult.Fail(failure.Value);
        }

        expense.ExpenseCategoryId = request.ExpenseCategoryId;
        expense.EventId = request.EventId;
        expense.WorkerId = request.WorkerId;
        expense.ExpenseDate = request.ExpenseDate;
        expense.Amount = request.Amount;
        expense.Description = request.Description;
        expense.PaymentMethod = request.PaymentMethod;
        expense.ReferenceNumber = request.ReferenceNumber;
        expense.UpdatedAt = DateTime.UtcNow;

        expenseRepository.Update(expense);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Expense updated", Module, studioId, ct);

        var updated = await expenseRepository.GetByIdAsync(studioId, expenseId, ct);
        return ExpenseWriteResult.Success(MapToDto(updated!));
    }

    public async Task<bool> DeleteAsync(int studioId, int expenseId, CancellationToken ct = default)
    {
        var expense = await expenseRepository.GetByIdAsync(studioId, expenseId, ct);
        if (expense is null)
        {
            return false;
        }

        expenseRepository.Remove(expense);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Expense deleted", Module, studioId, ct);
        return true;
    }

    private async Task<ExpenseWriteFailureReason?> ValidateReferencesAsync(int studioId, int expenseCategoryId, int? eventId, int? workerId, CancellationToken ct)
    {
        var category = await expenseCategoryRepository.GetByIdAsync(studioId, expenseCategoryId, ct);
        if (category is null)
        {
            return ExpenseWriteFailureReason.CategoryNotFound;
        }

        if (eventId is not null)
        {
            var evt = await eventRepository.GetByIdAsync(studioId, eventId.Value, ct);
            if (evt is null)
            {
                return ExpenseWriteFailureReason.EventNotFound;
            }
        }

        if (workerId is not null)
        {
            var worker = await workerRepository.GetByIdAsync(studioId, workerId.Value, ct);
            if (worker is null)
            {
                return ExpenseWriteFailureReason.WorkerNotFound;
            }
        }

        return null;
    }

    private static ExpenseDto MapToDto(Expense expense) => new()
    {
        ExpenseId = expense.ExpenseId,
        ExpenseCategoryId = expense.ExpenseCategoryId,
        ExpenseCategoryName = expense.ExpenseCategory.CategoryName,
        EventId = expense.EventId,
        EventVenue = expense.Event?.Venue,
        WorkerId = expense.WorkerId,
        WorkerName = expense.Worker?.FullName,
        ExpenseDate = expense.ExpenseDate,
        Amount = expense.Amount,
        Description = expense.Description,
        PaymentMethod = expense.PaymentMethod,
        ReferenceNumber = expense.ReferenceNumber,
        CreatedAt = expense.CreatedAt,
        UpdatedAt = expense.UpdatedAt
    };
}
