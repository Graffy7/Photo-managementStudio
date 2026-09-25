using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface ICustomerRepository
{
    Task<Customer?> GetByIdAsync(int studioId, int customerId, CancellationToken ct = default);

    // A customer of this studio (active or not) whose mobile has the same digits - spaces, dashes,
    // brackets and a leading + ignored; numbers of 10+ digits match on their last 10 so
    // "+91 98765 43210" and "9876543210" are the same person. Other studios are never looked at.
    Task<Customer?> FindByMobileDigitsAsync(int studioId, string digits, int? excludeCustomerId, CancellationToken ct = default);
    Task<(List<Customer> Items, int TotalCount)> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Customer customer, CancellationToken ct = default);
    void Update(Customer customer);
}
