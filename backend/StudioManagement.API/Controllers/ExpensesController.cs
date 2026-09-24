using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Expenses;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/expenses")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Expenses)]
public class ExpensesController(
    IExpenseService expenseService,
    IValidator<CreateExpenseRequestDto> createValidator,
    IValidator<UpdateExpenseRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] int? expenseCategoryId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await expenseService.SearchAsync(StudioId, search, expenseCategoryId, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var expense = await expenseService.GetByIdAsync(StudioId, id, ct);
        return expense is null ? NotFound() : Ok(expense);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateExpenseRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await expenseService.CreateAsync(StudioId, request, ct);
        return result.Succeeded ? Ok(result.Expense) : BadRequest(new { message = ReferenceErrorMessage(result.FailureReason!.Value) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateExpenseRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await expenseService.UpdateAsync(StudioId, id, request, ct);
        if (result is null)
        {
            return NotFound();
        }
        return result.Succeeded ? Ok(result.Expense) : BadRequest(new { message = ReferenceErrorMessage(result.FailureReason!.Value) });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await expenseService.DeleteAsync(StudioId, id, ct);
        return deleted ? NoContent() : NotFound();
    }

    private static string ReferenceErrorMessage(ExpenseWriteFailureReason reason) => reason switch
    {
        ExpenseWriteFailureReason.CategoryNotFound => "The selected expense category could not be found.",
        ExpenseWriteFailureReason.EventNotFound => "The selected event could not be found.",
        ExpenseWriteFailureReason.WorkerNotFound => "The selected worker could not be found.",
        _ => "Invalid request."
    };
}
