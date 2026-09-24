using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.ExpenseCategories;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/expense-categories")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Expenses)]
public class ExpenseCategoriesController(
    IExpenseCategoryService expenseCategoryService,
    IValidator<CreateExpenseCategoryRequestDto> createValidator,
    IValidator<UpdateExpenseCategoryRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Ok(await expenseCategoryService.GetAllAsync(StudioId, ct));

    [HttpPost]
    public async Task<IActionResult> Create(CreateExpenseCategoryRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await expenseCategoryService.CreateAsync(StudioId, request, ct);
        if (!result.Succeeded)
        {
            return Conflict(new { message = $"'{request.CategoryName}' already exists." });
        }
        return Ok(result.Category);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateExpenseCategoryRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await expenseCategoryService.UpdateAsync(StudioId, id, request, ct);
        if (!result.Succeeded)
        {
            return result.FailureReason == ExpenseCategoryFailureReason.DuplicateName
                ? Conflict(new { message = $"'{request.CategoryName}' already exists." })
                : NotFound();
        }
        return Ok(result.Category);
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct)
    {
        var result = await expenseCategoryService.SetActiveAsync(StudioId, id, true, ct);
        return result.Succeeded ? Ok(result.Category) : NotFound();
    }

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        var result = await expenseCategoryService.SetActiveAsync(StudioId, id, false, ct);
        return result.Succeeded ? Ok(result.Category) : NotFound();
    }
}
