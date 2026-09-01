using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class QuotationRepository(AppDbContext context) : IQuotationRepository
{
    public Task<Quotation?> GetByIdAsync(int studioId, int quotationId, CancellationToken ct = default) =>
        context.Quotations
            .Include(q => q.Customer)
            .Include(q => q.Event)
            .Include(q => q.Items).ThenInclude(i => i.Service)
            .FirstOrDefaultAsync(q => q.StudioId == studioId && q.QuotationId == quotationId, ct);

    public async Task<(List<Quotation> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? status, int? customerId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Quotations
            .AsNoTracking()
            .Include(q => q.Customer)
            .Include(q => q.Event)
            .Include(q => q.Items).ThenInclude(i => i.Service)
            .Where(q => q.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(q => q.QuotationNumber.Contains(term) || q.Customer.FullName.Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(q => q.Status == status);
        }

        if (customerId is not null)
        {
            query = query.Where(q => q.CustomerId == customerId);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(q => q.QuotationDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<int> CountAllAsync(int studioId, CancellationToken ct = default) =>
        context.Quotations.CountAsync(q => q.StudioId == studioId, ct);

    public async Task AddAsync(Quotation quotation, CancellationToken ct = default) =>
        await context.Quotations.AddAsync(quotation, ct);

    public void Update(Quotation quotation) => context.Quotations.Update(quotation);
}
