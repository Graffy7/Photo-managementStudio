using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Business.Reports;
using StudioManagement.Data.Common;
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
        page = Math.Clamp(page, 1, 100_000); // upper bound keeps (page - 1) * pageSize from overflowing
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

    public async Task<EventExpenseSummaryDto?> GetEventSummaryAsync(int studioId, int eventId, CancellationToken ct = default)
    {
        var @event = await eventRepository.GetByIdAsync(studioId, eventId, ct);
        if (@event is null)
        {
            return null;
        }

        var expenses = await expenseRepository.GetForEventAsync(studioId, eventId, ct);
        var total = @event.Budget ?? 0m;
        var totalExpenses = expenses.Sum(e => e.Amount);
        var pending = expenses.Where(e => e.PaymentStatus == ExpensePaymentStatuses.Pending).Sum(e => e.Amount);
        // Same rule as the event page and the payment screens: only completed payments count.
        var received = @event.Payments.Where(p => p.PaymentStatus == PaymentStatuses.Completed).Sum(p => p.Amount);

        return new EventExpenseSummaryDto
        {
            EventId = eventId,
            TotalEventAmount = total,
            TotalExpenses = totalExpenses,
            PaidExpenses = totalExpenses - pending,
            PendingExpenses = pending,
            NetProfit = total - totalExpenses,
            ProfitMarginPercent = EventProfitMath.MarginPercent(total, totalExpenses),
            AmountReceived = received,
            OutstandingBalance = total - received,
            Expenses = expenses.Select(MapToDto).ToList()
        };
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
            VendorName = Clean(request.VendorName),
            PaymentStatus = string.IsNullOrEmpty(request.PaymentStatus) ? ExpensePaymentStatuses.Paid : request.PaymentStatus,
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
        expense.VendorName = Clean(request.VendorName);
        // Left out by a screen that doesn't know the field: keep what is stored.
        if (!string.IsNullOrEmpty(request.PaymentStatus))
        {
            expense.PaymentStatus = request.PaymentStatus;
        }
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

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
        VendorName = expense.VendorName,
        PaymentStatus = expense.PaymentStatus,
        CreatedAt = expense.CreatedAt,
        UpdatedAt = expense.UpdatedAt
    };
}
