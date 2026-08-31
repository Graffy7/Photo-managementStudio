using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IStudioRepository : IRepository<Studio>
{
    Task<(List<Studio> Items, int TotalCount)> SearchAsync(string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);
    Task<List<Studio>> GetByIdsAsync(IEnumerable<int> ids, CancellationToken ct = default);
}
