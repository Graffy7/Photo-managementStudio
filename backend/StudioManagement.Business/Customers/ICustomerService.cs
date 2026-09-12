using StudioManagement.Business.Common;

namespace StudioManagement.Business.Customers;

public interface ICustomerService
{
    Task<PagedResult<CustomerDto>> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task<CustomerDto?> GetByIdAsync(int studioId, int customerId, CancellationToken ct = default);
    Task<CustomerDto> CreateAsync(int studioId, CreateCustomerRequestDto request, CancellationToken ct = default);
    Task<CustomerDto?> UpdateAsync(int studioId, int customerId, UpdateCustomerRequestDto request, CancellationToken ct = default);
    Task<CustomerDto?> SetActiveAsync(int studioId, int customerId, bool isActive, CancellationToken ct = default);
    Task<List<CustomerEventSummaryDto>> GetEventsAsync(int studioId, int customerId, CancellationToken ct = default);
}
