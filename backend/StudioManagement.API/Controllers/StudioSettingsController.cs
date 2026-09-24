using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Settings;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/studio-settings")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class StudioSettingsController(
    IStudioSettingsService studioSettingsService,
    IValidator<BusinessSettingsDto> businessValidator,
    IValidator<QuotationSettingsDto> quotationValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet("business")]
    public async Task<IActionResult> GetBusiness(CancellationToken ct) =>
        Ok(await studioSettingsService.GetBusinessSettingsAsync(StudioId, ct));

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPut("business")]
    public async Task<IActionResult> UpdateBusiness(BusinessSettingsDto request, CancellationToken ct)
    {
        var validation = await businessValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        return Ok(await studioSettingsService.UpdateBusinessSettingsAsync(StudioId, request, ct));
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotifications(CancellationToken ct) =>
        Ok(await studioSettingsService.GetNotificationSettingsAsync(StudioId, ct));

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPut("notifications")]
    public async Task<IActionResult> UpdateNotifications(NotificationSettingsDto request, CancellationToken ct) =>
        Ok(await studioSettingsService.UpdateNotificationSettingsAsync(StudioId, request, ct));

    [HttpGet("quotation")]
    public async Task<IActionResult> GetQuotation(CancellationToken ct) =>
        Ok(await studioSettingsService.GetQuotationSettingsAsync(StudioId, ct));

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPut("quotation")]
    public async Task<IActionResult> UpdateQuotation(QuotationSettingsDto request, CancellationToken ct)
    {
        var validation = await quotationValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        return Ok(await studioSettingsService.UpdateQuotationSettingsAsync(StudioId, request, ct));
    }
}
