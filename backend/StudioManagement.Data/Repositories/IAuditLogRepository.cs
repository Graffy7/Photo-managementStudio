using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IAuditLogRepository : IRepository<AuditLog>
{
    Task<(List<AuditLog> Items, int TotalCount)> SearchAsync(int? studioId, int page, int pageSize, CancellationToken ct = default);
}
