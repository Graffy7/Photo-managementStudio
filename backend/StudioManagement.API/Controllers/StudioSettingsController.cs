using StudioManagement.Business.Common;
using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Quotations;
using StudioManagement.Business.Settings;
using StudioManagement.Business.Storage;
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
    IValidator<PdfSettingsDto> pdfValidator,
    IQuotationPdfService pdfService,
    IFileStorage fileStorage,
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

    // ---- Quotation PDF look (this studio only) ------------------------------------------------

    private const long MaxSignatureBytes = 1024 * 1024;

    [HttpGet("pdf")]
    public async Task<IActionResult> GetPdf(CancellationToken ct) =>
        Ok(await studioSettingsService.GetPdfSettingsAsync(StudioId, ct));

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPut("pdf")]
    public async Task<IActionResult> UpdatePdf(PdfSettingsDto request, CancellationToken ct)
    {
        var validation = await pdfValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        return Ok(await studioSettingsService.UpdatePdfSettingsAsync(StudioId, request, ct));
    }

    // Renders a sample quotation with the settings as they are on screen (not saved). A preview
    // changes nothing, so it's allowed even while the studio is read-only.
    [AllowWhenReadOnly]
    [HttpPost("pdf/preview")]
    public async Task<IActionResult> PreviewPdf(PdfSettingsDto request, CancellationToken ct)
    {
        var validation = await pdfValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        // The signature shown is always this studio's own saved one.
        request.SignatureUrl = (await studioSettingsService.GetPdfSettingsAsync(StudioId, ct)).SignatureUrl;
        var bytes = await pdfService.GeneratePreviewAsync(StudioId, request, ct);
        return File(bytes, "application/pdf", "quotation-preview.pdf");
    }

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpPost("pdf/signature")]
    public async Task<IActionResult> UploadSignature(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "No file was uploaded." });
        if (file.Length > MaxSignatureBytes) return BadRequest(new { message = "The signature image must be 1MB or smaller." });

        // The bytes must be a real JPG/PNG; what's stored is our own re-encoded copy (PNG keeps transparency).
        await using var upload = file.OpenReadStream();
        var (image, error) = await SafeImage.ReencodeAsync(upload, MaxSignatureBytes, maxDimension: 1200, ct);
        if (image is null) return BadRequest(new { message = error });

        var previous = (await studioSettingsService.GetPdfSettingsAsync(StudioId, ct)).SignatureUrl;
        await using var clean = image.Content;
        var url = await fileStorage.SaveAsync(clean, "signature" + image.Extension, $"signatures/{StudioId}", ct);
        await studioSettingsService.SetPdfSignatureUrlAsync(StudioId, url, ct);
        if (!string.IsNullOrWhiteSpace(previous) && previous.StartsWith($"/uploads/signatures/{StudioId}/", StringComparison.Ordinal))
        {
            fileStorage.Delete(previous);
        }
        return Ok(await studioSettingsService.GetPdfSettingsAsync(StudioId, ct));
    }

    [FeatureRequired(FeatureCodes.Settings)]
    [HttpDelete("pdf/signature")]
    public async Task<IActionResult> RemoveSignature(CancellationToken ct)
    {
        var previous = (await studioSettingsService.GetPdfSettingsAsync(StudioId, ct)).SignatureUrl;
        await studioSettingsService.SetPdfSignatureUrlAsync(StudioId, null, ct);
        if (!string.IsNullOrWhiteSpace(previous) && previous.StartsWith($"/uploads/signatures/{StudioId}/", StringComparison.Ordinal))
        {
            fileStorage.Delete(previous);
        }
        return Ok(await studioSettingsService.GetPdfSettingsAsync(StudioId, ct));
    }
}
