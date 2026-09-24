using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Events;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/events")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class EventsController(
    IEventService eventService,
    IEventWorkerService eventWorkerService,
    IEventDeliveryService eventDeliveryService,
    IValidator<CreateEventRequestDto> createValidator,
    IValidator<UpdateEventRequestDto> updateValidator,
    IValidator<AddDeliveryItemRequestDto> addDeliveryValidator,
    IValidator<SetDeliveryStatusRequestDto> setDeliveryValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] string? eventStatus,
        [FromQuery] int? customerId,
        [FromQuery] DateTime? eventDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] DateTime? upcomingFrom = null,
        CancellationToken ct = default) =>
        Ok(await eventService.SearchAsync(StudioId, search, eventStatus, customerId, eventDate, page, pageSize, ct, upcomingFrom));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var @event = await eventService.GetByIdAsync(StudioId, id, ct);
        return @event is null ? NotFound() : Ok(@event);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateEventRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await eventService.CreateAsync(StudioId, request, ct);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = "The selected customer could not be found." });
        }
        return Ok(result.Event);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateEventRequestDto request, CancellationToken ct)
    {
        var validation = await updateValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await eventService.UpdateAsync(StudioId, id, request, ct);
        if (result is null)
        {
            return NotFound();
        }
        if (!result.Succeeded)
        {
            return BadRequest(new { message = "The selected customer could not be found." });
        }
        return Ok(result.Event);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var result = await eventService.DeleteAsync(StudioId, id, ct);
        return result switch
        {
            EventDeleteResult.NotFound => NotFound(),
            EventDeleteResult.HasQuotations => BadRequest(new { message = "This event has a quotation attached and can't be deleted. Cancel the event instead." }),
            EventDeleteResult.HasPhotoGallery => BadRequest(new { message = "This event has a photo selection gallery and can't be deleted. Cancel the event instead." }),
            _ => NoContent()
        };
    }

    [HttpPatch("{id:int}/notes")]
    public async Task<IActionResult> UpdateNotes(int id, UpdateEventNotesRequestDto request, CancellationToken ct)
    {
        var updated = await eventService.UpdateNotesAsync(StudioId, id, request.Notes, ct);
        return updated is null ? NotFound() : Ok(updated);
    }

    // The event's permanent history: crew, every quotation version and every payment.
    [HttpGet("{id:int}/history")]
    public async Task<IActionResult> GetHistory(int id, CancellationToken ct)
    {
        var history = await eventService.GetHistoryAsync(StudioId, id, ct);
        return history is null ? NotFound() : Ok(history);
    }

    // ---- Delivery checklist (completed events) ------------------------------------------------

    [HttpGet("{id:int}/delivery")]
    public async Task<IActionResult> GetDelivery(int id, CancellationToken ct)
    {
        var items = await eventDeliveryService.GetAsync(StudioId, id, ct);
        return items is null ? NotFound() : Ok(items);
    }

    [HttpPost("{id:int}/delivery")]
    public async Task<IActionResult> AddDeliveryItem(int id, AddDeliveryItemRequestDto request, CancellationToken ct)
    {
        var validation = await addDeliveryValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await eventDeliveryService.AddCustomAsync(StudioId, id, request, ct);
        return DeliveryResponse(result);
    }

    [HttpPut("{id:int}/delivery")]
    public async Task<IActionResult> SetDeliveryStatus(int id, SetDeliveryStatusRequestDto request, CancellationToken ct)
    {
        var validation = await setDeliveryValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await eventDeliveryService.SetStatusAsync(StudioId, id, request, ct);
        return DeliveryResponse(result);
    }

    [HttpDelete("{id:int}/delivery/{itemId:int}")]
    public async Task<IActionResult> DeleteDeliveryItem(int id, int itemId, CancellationToken ct)
    {
        var result = await eventDeliveryService.DeleteCustomAsync(StudioId, id, itemId, ct);
        return result.Succeeded ? NoContent() : DeliveryResponse(result);
    }

    private IActionResult DeliveryResponse(DeliveryResult result)
    {
        if (result.Succeeded)
        {
            return Ok(result.Item);
        }

        return result.FailureReason switch
        {
            DeliveryFailureReason.EventNotFound => NotFound(),
            DeliveryFailureReason.ItemNotFound => NotFound(new { message = "That delivery item no longer exists." }),
            DeliveryFailureReason.DuplicateName => Conflict(new { message = "This event already has a delivery item with that name." }),
            DeliveryFailureReason.StandardItemCannotBeDeleted => BadRequest(new { message = "Album, Video and Photos are standard items and can't be removed." }),
            _ => BadRequest(new { message = "Invalid request." })
        };
    }

    [HttpGet("{id:int}/workers")]
    public async Task<IActionResult> GetAssignedWorkers(int id, CancellationToken ct)
    {
        var workers = await eventWorkerService.GetAssignedWorkersAsync(StudioId, id, ct);
        return workers is null ? NotFound() : Ok(workers);
    }

    [HttpPost("{id:int}/workers")]
    public async Task<IActionResult> AssignWorker(int id, AssignWorkerRequestDto request, CancellationToken ct)
    {
        var result = await eventWorkerService.AssignWorkerAsync(StudioId, id, request, ct);
        if (result.Succeeded)
        {
            return Ok(result.Assignment);
        }

        return result.FailureReason switch
        {
            EventWorkerFailureReason.EventNotFound => NotFound(),
            EventWorkerFailureReason.WorkerNotFound => BadRequest(new { message = "The selected worker could not be found." }),
            EventWorkerFailureReason.AlreadyAssigned => Conflict(new { message = "This worker is already assigned to the event." }),
            _ => BadRequest(new { message = "Invalid request." })
        };
    }

    [HttpDelete("{id:int}/workers/{workerId:int}")]
    public async Task<IActionResult> UnassignWorker(int id, int workerId, CancellationToken ct)
    {
        var result = await eventWorkerService.UnassignWorkerAsync(StudioId, id, workerId, ct);
        return result switch
        {
            null => NotFound(),
            false => NotFound(new { message = "This worker is not assigned to the event." }),
            true => NoContent()
        };
    }
}
