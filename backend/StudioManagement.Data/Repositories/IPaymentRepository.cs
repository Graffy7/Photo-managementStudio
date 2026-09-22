using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPaymentRepository
{
    Task<Payment?> GetByIdAsync(int studioId, int paymentId, CancellationToken ct = default);
    Task<(List<Payment> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? paymentStatus, int? customerId, int page, int pageSize, CancellationToken ct = default);
    Task<List<Payment>> GetForEventAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<List<(int EventId, decimal TotalPaid)>> GetCompletedTotalsByEventIdsAsync(int studioId, List<int> eventIds, CancellationToken ct = default);
    Task AddAsync(Payment payment, CancellationToken ct = default);
    void Update(Payment payment);
}
