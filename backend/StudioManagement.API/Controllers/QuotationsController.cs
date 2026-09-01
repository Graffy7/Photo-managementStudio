using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Quotations;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/quotations")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class QuotationsController(
    IQuotationService quotationService,
    IQuotationPdfService quotationPdfService,
    IValidator<CreateQuotationRequestDto> createValidator,
    IValidator<UpdateQuotationRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int? customerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await quotationService.SearchAsync(StudioId, search, status, customerId, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var quotation = await quotationService.GetByIdAsync(StudioId, id, ct);
        return quotation is null ? NotFound() : Ok(quotation);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateQuotationRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await quotationService.CreateAsync(StudioId, request, ct);
        return result.Succeeded ? Ok(result.Quotation) : BadRequest(new { message = ReferenceErrorMessage(result.FailureReason!.Value) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateQuotationRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await quotationService.UpdateAsync(StudioId, id, request, ct);
        if (result is null)
        {
            return NotFound();
        }
        return result.Succeeded ? Ok(result.Quotation) : BadRequest(new { message = ReferenceErrorMessage(result.FailureReason!.Value) });
    }

    [HttpGet("{id:int}/pdf")]
    public async Task<IActionResult> DownloadPdf(int id, CancellationToken ct)
    {
        var quotation = await quotationService.GetByIdAsync(StudioId, id, ct);
        if (quotation is null)
        {
            return NotFound();
        }

        var pdfBytes = await quotationPdfService.GenerateAsync(StudioId, quotation, ct);
        return File(pdfBytes, "application/pdf", $"{quotation.QuotationNumber}.pdf");
    }

    private static string ReferenceErrorMessage(QuotationWriteFailureReason reason) => reason switch
    {
        QuotationWriteFailureReason.CustomerNotFound => "The selected customer could not be found.",
        QuotationWriteFailureReason.EventNotFound => "The selected event could not be found.",
        QuotationWriteFailureReason.ServiceNotFound => "One of the selected services could not be found.",
        _ => "Invalid request."
    };
}
