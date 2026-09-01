using StudioManagement.Business.Audit;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.ExpenseCategories;

public class ExpenseCategoryService(
    IExpenseCategoryRepository categoryRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IExpenseCategoryService
{
    private const string Module = "ExpenseCategories";
    public async Task<List<ExpenseCategoryDto>> GetAllAsync(int studioId, CancellationToken ct = default)
    {
        var items = await categoryRepository.GetAllAsync(studioId, ct);
        return items.OrderBy(c => c.CategoryName).Select(MapToDto).ToList();
    }

    public async Task<ExpenseCategoryResult> CreateAsync(int studioId, CreateExpenseCategoryRequestDto request, CancellationToken ct = default)
    {
        var existing = await categoryRepository.GetAllAsync(studioId, ct);
        if (existing.Any(c => string.Equals(c.CategoryName, request.CategoryName, StringComparison.OrdinalIgnoreCase)))
        {
            return ExpenseCategoryResult.Fail(ExpenseCategoryFailureReason.DuplicateName);
        }

        var now = DateTime.UtcNow;
        var category = new ExpenseCategory
        {
            StudioId = studioId,
            CategoryName = request.CategoryName,
            Description = request.Description,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        await categoryRepository.AddAsync(category, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Expense category created: {category.CategoryName}", Module, studioId, ct);
        return ExpenseCategoryResult.Success(MapToDto(category));
    }

    public async Task<ExpenseCategoryResult> UpdateAsync(int studioId, int expenseCategoryId, UpdateExpenseCategoryRequestDto request, CancellationToken ct = default)
    {
        var category = await categoryRepository.GetByIdAsync(studioId, expenseCategoryId, ct);
        if (category is null)
        {
            return ExpenseCategoryResult.Fail(ExpenseCategoryFailureReason.NotFound);
        }

        var existing = await categoryRepository.GetAllAsync(studioId, ct);
        if (existing.Any(c => c.ExpenseCategoryId != expenseCategoryId && string.Equals(c.CategoryName, request.CategoryName, StringComparison.OrdinalIgnoreCase)))
        {
            return ExpenseCategoryResult.Fail(ExpenseCategoryFailureReason.DuplicateName);
        }

        category.CategoryName = request.CategoryName;
        category.Description = request.Description;
        category.UpdatedAt = DateTime.UtcNow;

        categoryRepository.Update(category);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Expense category updated: {category.CategoryName}", Module, studioId, ct);
        return ExpenseCategoryResult.Success(MapToDto(category));
    }

    public async Task<ExpenseCategoryResult> SetActiveAsync(int studioId, int expenseCategoryId, bool isActive, CancellationToken ct = default)
    {
        var category = await categoryRepository.GetByIdAsync(studioId, expenseCategoryId, ct);
        if (category is null)
        {
            return ExpenseCategoryResult.Fail(ExpenseCategoryFailureReason.NotFound);
        }

        category.IsActive = isActive;
        category.UpdatedAt = DateTime.UtcNow;

        categoryRepository.Update(category);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(
            isActive ? $"Expense category activated: {category.CategoryName}" : $"Expense category deactivated: {category.CategoryName}", Module, studioId, ct);
        return ExpenseCategoryResult.Success(MapToDto(category));
    }

    private static ExpenseCategoryDto MapToDto(ExpenseCategory category) => new()
    {
        ExpenseCategoryId = category.ExpenseCategoryId,
        CategoryName = category.CategoryName,
        Description = category.Description,
        IsActive = category.IsActive,
        CreatedAt = category.CreatedAt,
        UpdatedAt = category.UpdatedAt
    };
}
