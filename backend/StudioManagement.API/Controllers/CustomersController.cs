using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Customers;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Customers)]
public class CustomersController(
    ICustomerService customerService,
    IValidator<CreateCustomerRequestDto> createValidator,
    IValidator<UpdateCustomerRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await customerService.SearchAsync(StudioId, search, isActive, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var customer = await customerService.GetByIdAsync(StudioId, id, ct);
        return customer is null ? NotFound() : Ok(customer);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateCustomerRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        if (await customerService.FindMobileDuplicateAsync(StudioId, request.MobileNumber, null, ct) is { } existing)
        {
            return DuplicateMobile(existing);
        }

        var customer = await customerService.CreateAsync(StudioId, request, ct);
        return Ok(customer);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateCustomerRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        // Only when the number is being changed: customers already sharing a number from before this
        // rule can still have their other details edited.
        var current = await customerService.GetByIdAsync(StudioId, id, ct);
        var digits = (string? v) => new string((v ?? "").Where(char.IsDigit).ToArray());
        if (current is not null && digits(current.MobileNumber) != digits(request.MobileNumber)
            && await customerService.FindMobileDuplicateAsync(StudioId, request.MobileNumber, id, ct) is { } existing)
        {
            return DuplicateMobile(existing);
        }

        var customer = await customerService.UpdateAsync(StudioId, id, request, ct);
        return customer is null ? NotFound() : Ok(customer);
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct)
    {
        var customer = await customerService.SetActiveAsync(StudioId, id, true, ct);
        return customer is null ? NotFound() : Ok(customer);
    }

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        var customer = await customerService.SetActiveAsync(StudioId, id, false, ct);
        return customer is null ? NotFound() : Ok(customer);
    }

    [HttpGet("{id:int}/events")]
    public async Task<IActionResult> GetEvents(int id, CancellationToken ct)
    {
        var customer = await customerService.GetByIdAsync(StudioId, id, ct);
        if (customer is null)
        {
            return NotFound();
        }

        return Ok(await customerService.GetEventsAsync(StudioId, id, ct));
    }

    // One mobile number = one customer within a studio (other studios may have the same number).
    private IActionResult DuplicateMobile(CustomerDto existing) => Conflict(new
    {
        code = "DUPLICATE_MOBILE",
        field = "mobileNumber",
        message = existing.IsActive
            ? $"{existing.FullName} already uses this mobile number."
            : $"{existing.FullName} (deactivated) already uses this mobile number. Activate that customer instead.",
        existingCustomerId = existing.CustomerId,
        existingCustomerName = existing.FullName,
        existingIsActive = existing.IsActive
    });
}
