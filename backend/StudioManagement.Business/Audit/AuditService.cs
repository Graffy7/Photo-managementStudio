using StudioManagement.Business.Common;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Audit;

public class AuditService(
    IAuditLogRepository auditLogRepository,
    IStudioRepository studioRepository,
    IUserRepository userRepository,
    ITenantContext tenantContext,
    IUnitOfWork unitOfWork) : IAuditService
{
    public async Task LogAsync(string action, string module, int? studioId, CancellationToken ct = default)
    {
        var entry = new AuditLog
        {
            Action = action,
            Module = module,
            EntityName = "Studio",
            EntityId = studioId,
            StudioId = studioId,
            UserId = tenantContext.CurrentUserId,
            CreatedAt = DateTime.UtcNow
        };

        await auditLogRepository.AddAsync(entry, ct);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<PagedResult<AuditLogDto>> SearchAsync(int? studioId, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await auditLogRepository.SearchAsync(studioId, page, pageSize, ct);

        var studioIds = items.Where(a => a.StudioId is not null).Select(a => a.StudioId!.Value).Distinct().ToList();
        var userIds = items.Where(a => a.UserId is not null).Select(a => a.UserId!.Value).Distinct().ToList();

        var studioNames = (await studioRepository.GetByIdsAsync(studioIds, ct)).ToDictionary(s => s.StudioId, s => s.StudioName);
        var actorNames = (await userRepository.GetByIdsAsync(userIds, ct)).ToDictionary(u => u.UserId, u => u.FullName);

        var dtos = items.Select(a => new AuditLogDto
        {
            AuditLogId = a.AuditLogId,
            Action = a.Action,
            Module = a.Module,
            StudioId = a.StudioId,
            StudioName = a.StudioId is not null && studioNames.TryGetValue(a.StudioId.Value, out var name) ? name : null,
            UserId = a.UserId,
            ActorName = a.UserId is not null && actorNames.TryGetValue(a.UserId.Value, out var actor) ? actor : null,
            CreatedAt = a.CreatedAt
        }).ToList();

        return new PagedResult<AuditLogDto> { Items = dtos, TotalCount = totalCount, Page = page, PageSize = pageSize };
    }
}
