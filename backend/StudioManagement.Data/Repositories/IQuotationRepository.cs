using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IQuotationRepository
{
    Task<Quotation?> GetByIdAsync(int studioId, int quotationId, CancellationToken ct = default);
    Task<(List<Quotation> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? status, int? customerId, int page, int pageSize, CancellationToken ct = default);
    Task<int> CountAllAsync(int studioId, CancellationToken ct = default);
    Task AddAsync(Quotation quotation, CancellationToken ct = default);
    void Update(Quotation quotation);
}
