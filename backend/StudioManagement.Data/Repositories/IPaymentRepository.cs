using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPaymentRepository
{
    Task<Payment?> GetByIdAsync(int studioId, int paymentId, CancellationToken ct = default);
    Task<(List<Payment> Items, int TotalCount)> SearchAsync(int studioId, string? search, string? paymentStatus, int? customerId, int page, int pageSize, CancellationToken ct = default);
    Task<List<Payment>> GetForEventAsync(int studioId, int eventId, CancellationToken ct = default);
    Task<List<(int EventId, decimal TotalPaid)>> GetCompletedTotalsByEventIdsAsync(int studioId, List<int> eventIds, CancellationToken ct = default);
    // Completed total for one event / one customer, optionally leaving out one payment (the one
    // being edited). Used to check a new amount against what is due or already paid.
    Task<decimal> GetCompletedTotalForEventAsync(int studioId, int eventId, int? excludePaymentId, CancellationToken ct = default);
    Task<decimal> GetCompletedTotalForCustomerAsync(int studioId, int customerId, int? excludePaymentId, CancellationToken ct = default);
    // Holds an update lock on the event (or customer) row until the surrounding transaction ends,
    // so two payments saved at the same moment can't both pass the balance check.
    Task LockForPaymentAsync(int studioId, int customerId, int? eventId, CancellationToken ct = default);
    Task AddAsync(Payment payment, CancellationToken ct = default);
    void Update(Payment payment);
}
