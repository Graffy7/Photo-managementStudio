using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Leads;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/leads")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Leads)]
public class LeadsController(
    ILeadService leadService,
    IValidator<CreateLeadRequestDto> createValidator,
    IValidator<UpdateLeadRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] int? leadStatusId,
        [FromQuery] DateTime? createdFrom,
        [FromQuery] DateTime? createdTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await leadService.SearchAsync(StudioId, search, leadStatusId, createdFrom, createdTo, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var lead = await leadService.GetByIdAsync(StudioId, id, ct);
        return lead is null ? NotFound() : Ok(lead);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateLeadRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var lead = await leadService.CreateAsync(StudioId, request, ct);
        return Ok(lead);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateLeadRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var lead = await leadService.UpdateAsync(StudioId, id, request, ct);
        return lead is null ? NotFound() : Ok(lead);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await leadService.DeleteAsync(StudioId, id, ct);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:int}/convert")]
    public async Task<IActionResult> Convert(int id, CancellationToken ct)
    {
        var result = await leadService.ConvertToCustomerAsync(StudioId, id, ct);
        if (!result.Succeeded)
        {
            return result.FailureReason == LeadConversionFailureReason.NotFound
                ? NotFound()
                : Conflict(new { message = "This lead has already been converted to a customer." });
        }
        return Ok(result.Lead);
    }
}
