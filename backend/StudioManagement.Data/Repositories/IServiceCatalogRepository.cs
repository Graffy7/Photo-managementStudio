using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IServiceCatalogRepository
{
    Task<Service?> GetByIdAsync(int studioId, int serviceId, CancellationToken ct = default);
    Task<(List<Service> Items, int TotalCount)> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Service service, CancellationToken ct = default);
    void Update(Service service);
}
