using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Tenant;
using StudioManagement.Business.Workers;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/workers")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Workers)]
public class WorkersController(
    IWorkerService workerService,
    IValidator<CreateWorkerRequestDto> createValidator,
    IValidator<UpdateWorkerRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] int? workerTypeId,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await workerService.SearchAsync(StudioId, search, workerTypeId, isActive, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var worker = await workerService.GetByIdAsync(StudioId, id, ct);
        return worker is null ? NotFound() : Ok(worker);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateWorkerRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var worker = await workerService.CreateAsync(StudioId, request, ct);
        return Ok(worker);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateWorkerRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var worker = await workerService.UpdateAsync(StudioId, id, request, ct);
        return worker is null ? NotFound() : Ok(worker);
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct)
    {
        var worker = await workerService.SetActiveAsync(StudioId, id, true, ct);
        return worker is null ? NotFound() : Ok(worker);
    }

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        var worker = await workerService.SetActiveAsync(StudioId, id, false, ct);
        return worker is null ? NotFound() : Ok(worker);
    }
}
