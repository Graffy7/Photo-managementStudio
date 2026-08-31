using StudioManagement.Business.Common;

namespace StudioManagement.Business.Audit;

public interface IAuditService
{
    Task LogAsync(string action, string module, int? studioId, CancellationToken ct = default);
    Task<PagedResult<AuditLogDto>> SearchAsync(int? studioId, int page, int pageSize, CancellationToken ct = default);
}
