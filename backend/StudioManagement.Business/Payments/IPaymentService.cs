using StudioManagement.Business.Common;

namespace StudioManagement.Business.Payments;

public interface IPaymentService
{
    Task<PagedResult<PaymentDto>> SearchAsync(int studioId, string? search, string? paymentStatus, int? customerId, int page, int pageSize, CancellationToken ct = default);
    Task<PaymentDto?> GetByIdAsync(int studioId, int paymentId, CancellationToken ct = default);
    Task<PaymentWriteResult> CreateAsync(int studioId, CreatePaymentRequestDto request, CancellationToken ct = default);
    Task<PaymentWriteResult?> UpdateAsync(int studioId, int paymentId, UpdatePaymentRequestDto request, CancellationToken ct = default);
}
