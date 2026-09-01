using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class CustomerRepository(AppDbContext context) : ICustomerRepository
{
    public Task<Customer?> GetByIdAsync(int studioId, int customerId, CancellationToken ct = default) =>
        context.Customers.FirstOrDefaultAsync(c => c.StudioId == studioId && c.CustomerId == customerId, ct);

    public async Task<(List<Customer> Items, int TotalCount)> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Customers
            .AsNoTracking()
            .Where(c => c.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c => c.FullName.Contains(term) || c.MobileNumber.Contains(term));
        }

        if (isActive is not null)
        {
            query = query.Where(c => c.IsActive == isActive);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task AddAsync(Customer customer, CancellationToken ct = default) =>
        await context.Customers.AddAsync(customer, ct);

    public void Update(Customer customer) => context.Customers.Update(customer);
}
