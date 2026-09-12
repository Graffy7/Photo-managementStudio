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
    IValidator<CreateEventRequestDto> createValidator,
    IValidator<UpdateEventRequestDto> updateValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? search,
        [FromQuery] string? eventStatus,
        [FromQuery] int? customerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await eventService.SearchAsync(StudioId, search, eventStatus, customerId, page, pageSize, ct));

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

    [HttpPatch("{id:int}/notes")]
    public async Task<IActionResult> UpdateNotes(int id, UpdateEventNotesRequestDto request, CancellationToken ct)
    {
        var updated = await eventService.UpdateNotesAsync(StudioId, id, request.Notes, ct);
        return updated is null ? NotFound() : Ok(updated);
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
