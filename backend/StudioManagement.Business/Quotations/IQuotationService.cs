using StudioManagement.Business.Common;

namespace StudioManagement.Business.Quotations;

public interface IQuotationService
{
    Task<PagedResult<QuotationDto>> SearchAsync(int studioId, string? search, string? status, int? customerId, int page, int pageSize, CancellationToken ct = default);
    Task<QuotationDto?> GetByIdAsync(int studioId, int quotationId, CancellationToken ct = default);
    Task<QuotationWriteResult> CreateAsync(int studioId, CreateQuotationRequestDto request, CancellationToken ct = default);
    Task<QuotationWriteResult?> UpdateAsync(int studioId, int quotationId, UpdateQuotationRequestDto request, CancellationToken ct = default);
}
