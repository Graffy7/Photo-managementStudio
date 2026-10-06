using StudioManagement.Business.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Lookups;

// Dropdown values (event types, enquiry sources/statuses, worker roles) belong to one studio. Any id a
// request carries is checked against the signed-in studio before it's saved, so a studio can't attach -
// or read the name of - another studio's value. The studio id always comes from the token, never the request.
public interface IStudioLookupGuard
{
    Task EnsureOwnedAsync(int studioId, int? eventTypeId = null, int? leadSourceId = null, int? leadStatusId = null,
        int? workerTypeId = null, CancellationToken ct = default);
}

public class StudioLookupGuard(
    ITenantRepository<EventType> eventTypes,
    ITenantRepository<LeadSource> leadSources,
    ITenantRepository<LeadStatus> leadStatuses,
    ITenantRepository<WorkerType> workerTypes) : IStudioLookupGuard
{
    public async Task EnsureOwnedAsync(int studioId, int? eventTypeId = null, int? leadSourceId = null, int? leadStatusId = null,
        int? workerTypeId = null, CancellationToken ct = default)
    {
        if (eventTypeId is not null && await eventTypes.GetByIdAsync(studioId, eventTypeId.Value, ct) is null)
        {
            throw new InvalidReferenceException("eventTypeId", "The selected event type could not be found.");
        }
        if (leadSourceId is not null && await leadSources.GetByIdAsync(studioId, leadSourceId.Value, ct) is null)
        {
            throw new InvalidReferenceException("leadSourceId", "The selected enquiry source could not be found.");
        }
        if (leadStatusId is not null && await leadStatuses.GetByIdAsync(studioId, leadStatusId.Value, ct) is null)
        {
            throw new InvalidReferenceException("leadStatusId", "The selected enquiry status could not be found.");
        }
        if (workerTypeId is not null && await workerTypes.GetByIdAsync(studioId, workerTypeId.Value, ct) is null)
        {
            throw new InvalidReferenceException("workerTypeId", "The selected worker role could not be found.");
        }
    }
}
