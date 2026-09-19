using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Lookups;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.API.Controllers;

public abstract class LookupControllerBase<T>(
    ILookupService<T> lookupService,
    IValidator<CreateLookupRequestDto> createValidator,
    IValidator<UpdateLookupRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
    where T : class, ITenantEntity, INamedLookup, new()
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        Ok(await lookupService.GetAllAsync(StudioId, ct));

    [HttpPost]
    public async Task<IActionResult> Create(CreateLookupRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await lookupService.CreateAsync(StudioId, request, ct);
        if (!result.Succeeded)
        {
            return Conflict(new { message = $"'{request.Name}' already exists." });
        }
        return Ok(result.Lookup);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateLookupRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await lookupService.UpdateAsync(StudioId, id, request, ct);
        if (!result.Succeeded)
        {
            return result.FailureReason == LookupFailureReason.DuplicateName
                ? Conflict(new { message = $"'{request.Name}' already exists." })
                : NotFound();
        }
        return Ok(result.Lookup);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var result = await lookupService.DeleteAsync(StudioId, id, ct);
        return result switch
        {
            LookupDeleteResult.NotFound => NotFound(),
            LookupDeleteResult.InUse => Conflict(new { message = "This is already used by existing records, so it can't be deleted. Deactivate it instead." }),
            _ => NoContent()
        };
    }
}

[ApiController]
[Route("api/event-types")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class EventTypesController(
    ILookupService<EventType> lookupService,
    IValidator<CreateLookupRequestDto> createValidator,
    IValidator<UpdateLookupRequestDto> updateValidator,
    ITenantContext tenantContext) : LookupControllerBase<EventType>(lookupService, createValidator, updateValidator, tenantContext);

[ApiController]
[Route("api/lead-sources")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class LeadSourcesController(
    ILookupService<LeadSource> lookupService,
    IValidator<CreateLookupRequestDto> createValidator,
    IValidator<UpdateLookupRequestDto> updateValidator,
    ITenantContext tenantContext) : LookupControllerBase<LeadSource>(lookupService, createValidator, updateValidator, tenantContext);

[ApiController]
[Route("api/lead-statuses")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class LeadStatusesController(
    ILookupService<LeadStatus> lookupService,
    IValidator<CreateLookupRequestDto> createValidator,
    IValidator<UpdateLookupRequestDto> updateValidator,
    ITenantContext tenantContext) : LookupControllerBase<LeadStatus>(lookupService, createValidator, updateValidator, tenantContext);

[ApiController]
[Route("api/worker-types")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class WorkerTypesController(
    ILookupService<WorkerType> lookupService,
    IValidator<CreateLookupRequestDto> createValidator,
    IValidator<UpdateLookupRequestDto> updateValidator,
    ITenantContext tenantContext) : LookupControllerBase<WorkerType>(lookupService, createValidator, updateValidator, tenantContext);
