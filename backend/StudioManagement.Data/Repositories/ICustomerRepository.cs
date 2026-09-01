using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(int studioId, int customerId, CancellationToken ct = default);
    Task<(List<Customer> Items, int TotalCount)> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Customer customer, CancellationToken ct = default);
    void Update(Customer customer);
}
