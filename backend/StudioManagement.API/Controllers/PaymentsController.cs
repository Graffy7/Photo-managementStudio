using StudioManagement.API.Filters;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Payments;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.Payments)]
public class PaymentsController(
    IPaymentService paymentService,
    IValidator<CreatePaymentRequestDto> createValidator,
    IValidator<UpdatePaymentRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] string? paymentStatus,
        [FromQuery] int? customerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await paymentService.SearchAsync(StudioId, search, paymentStatus, customerId, page, pageSize, ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var payment = await paymentService.GetByIdAsync(StudioId, id, ct);
        return payment is null ? NotFound() : Ok(payment);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreatePaymentRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await paymentService.CreateAsync(StudioId, request, ct);
        return result.Succeeded ? Ok(result.Payment) : BadRequest(new { message = ReferenceErrorMessage(result.FailureReason!.Value) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdatePaymentRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await paymentService.UpdateAsync(StudioId, id, request, ct);
        if (result is null)
        {
            return NotFound();
        }
        return result.Succeeded ? Ok(result.Payment) : BadRequest(new { message = ReferenceErrorMessage(result.FailureReason!.Value) });
    }

    private static string ReferenceErrorMessage(PaymentWriteFailureReason reason) => reason switch
    {
        PaymentWriteFailureReason.CustomerNotFound => "The selected customer could not be found.",
        PaymentWriteFailureReason.EventNotFound => "The selected event could not be found.",
        _ => "Invalid request."
    };
}
