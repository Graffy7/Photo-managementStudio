using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.FormConfig;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/form-config/{formCode}")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class FormFieldsController(
    IFormConfigurationService formConfigurationService,
    IValidator<UpdateFormFieldRequestDto> updateValidator,
    IValidator<CreateCustomFieldRequestDto> createValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet("fields")]
    public async Task<IActionResult> GetFields(string formCode, CancellationToken ct)
    {
        var fields = await formConfigurationService.GetFieldsAsync(StudioId, formCode, ct);
        return fields is null ? NotFound(new { message = $"Unknown form '{formCode}'." }) : Ok(fields);
    }

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPut("fields/{formFieldId:int}")]
    public async Task<IActionResult> UpdateField(string formCode, int formFieldId, UpdateFormFieldRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var field = await formConfigurationService.UpdateFieldAsync(StudioId, formCode, formFieldId, request, ct);
        return field is null ? NotFound() : Ok(field);
    }

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPost("fields")]
    public async Task<IActionResult> AddCustomField(string formCode, CreateCustomFieldRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var field = await formConfigurationService.AddCustomFieldAsync(StudioId, formCode, request, ct);
        return field is null ? NotFound(new { message = $"Unknown form '{formCode}'." }) : Ok(field);
    }
}
