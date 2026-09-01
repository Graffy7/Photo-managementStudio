using StudioManagement.Business.Common;

namespace StudioManagement.Business.Services;

public interface IServiceCatalogService
{
    Task<PagedResult<ServiceCatalogDto>> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task<ServiceCatalogDto?> GetByIdAsync(int studioId, int serviceId, CancellationToken ct = default);
    Task<ServiceCatalogDto> CreateAsync(int studioId, CreateServiceRequestDto request, CancellationToken ct = default);
    Task<ServiceCatalogDto?> UpdateAsync(int studioId, int serviceId, UpdateServiceRequestDto request, CancellationToken ct = default);
    Task<ServiceCatalogDto?> SetActiveAsync(int studioId, int serviceId, bool isActive, CancellationToken ct = default);
}
