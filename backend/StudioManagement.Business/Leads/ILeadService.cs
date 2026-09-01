using StudioManagement.Business.Common;

namespace StudioManagement.Business.Leads;

public interface ILeadService
{
    Task<PagedResult<LeadDto>> SearchAsync(int studioId, string? search, int? leadStatusId, int page, int pageSize, CancellationToken ct = default);
    Task<LeadDto?> GetByIdAsync(int studioId, int leadId, CancellationToken ct = default);
    Task<LeadDto> CreateAsync(int studioId, CreateLeadRequestDto request, CancellationToken ct = default);
    Task<LeadDto?> UpdateAsync(int studioId, int leadId, UpdateLeadRequestDto request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int studioId, int leadId, CancellationToken ct = default);
    Task<LeadConversionResult> ConvertToCustomerAsync(int studioId, int leadId, CancellationToken ct = default);
}
