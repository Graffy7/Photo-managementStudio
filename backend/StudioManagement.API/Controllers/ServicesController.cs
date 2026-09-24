using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Services;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/services")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Services)]
public class ServicesController(
    IServiceCatalogService serviceCatalogService,
    IValidator<CreateServiceRequestDto> createValidator,
    IValidator<UpdateServiceRequestDto> updateValidator,
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
        Ok(await serviceCatalogService.SearchAsync(StudioId, search, isActive, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var service = await serviceCatalogService.GetByIdAsync(StudioId, id, ct);
        return service is null ? NotFound() : Ok(service);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateServiceRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var service = await serviceCatalogService.CreateAsync(StudioId, request, ct);
        return Ok(service);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateServiceRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var service = await serviceCatalogService.UpdateAsync(StudioId, id, request, ct);
        return service is null ? NotFound() : Ok(service);
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken ct)
    {
        var service = await serviceCatalogService.SetActiveAsync(StudioId, id, true, ct);
        return service is null ? NotFound() : Ok(service);
    }

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        var service = await serviceCatalogService.SetActiveAsync(StudioId, id, false, ct);
        return service is null ? NotFound() : Ok(service);
    }
}
