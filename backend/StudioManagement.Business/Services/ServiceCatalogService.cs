using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Services;

public class ServiceCatalogService(
    IServiceCatalogRepository serviceRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IServiceCatalogService
{
    private const string Module = "Services";

    public async Task<PagedResult<ServiceCatalogDto>> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await serviceRepository.SearchAsync(studioId, search, isActive, page, pageSize, ct);
        return new PagedResult<ServiceCatalogDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<ServiceCatalogDto?> GetByIdAsync(int studioId, int serviceId, CancellationToken ct = default)
    {
        var service = await serviceRepository.GetByIdAsync(studioId, serviceId, ct);
        return service is null ? null : MapToDto(service);
    }

    public async Task<ServiceCatalogDto> CreateAsync(int studioId, CreateServiceRequestDto request, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var service = new Service
        {
            StudioId = studioId,
            ServiceName = request.ServiceName,
            Description = request.Description,
            DefaultPrice = request.DefaultPrice,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        await serviceRepository.AddAsync(service, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Service created", Module, studioId, ct);

        return MapToDto(service);
    }

    public async Task<ServiceCatalogDto?> UpdateAsync(int studioId, int serviceId, UpdateServiceRequestDto request, CancellationToken ct = default)
    {
        var service = await serviceRepository.GetByIdAsync(studioId, serviceId, ct);
        if (service is null)
        {
            return null;
        }

        service.ServiceName = request.ServiceName;
        service.Description = request.Description;
        service.DefaultPrice = request.DefaultPrice;
        service.UpdatedAt = DateTime.UtcNow;

        serviceRepository.Update(service);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Service updated", Module, studioId, ct);

        return MapToDto(service);
    }

    public async Task<ServiceCatalogDto?> SetActiveAsync(int studioId, int serviceId, bool isActive, CancellationToken ct = default)
    {
        var service = await serviceRepository.GetByIdAsync(studioId, serviceId, ct);
        if (service is null)
        {
            return null;
        }

        service.IsActive = isActive;
        service.UpdatedAt = DateTime.UtcNow;

        serviceRepository.Update(service);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(isActive ? "Service activated" : "Service deactivated", Module, studioId, ct);

        return MapToDto(service);
    }

    private static ServiceCatalogDto MapToDto(Service service) => new()
    {
        ServiceId = service.ServiceId,
        ServiceName = service.ServiceName,
        Description = service.Description,
        DefaultPrice = service.DefaultPrice,
        IsActive = service.IsActive,
        CreatedAt = service.CreatedAt,
        UpdatedAt = service.UpdatedAt
    };
}
