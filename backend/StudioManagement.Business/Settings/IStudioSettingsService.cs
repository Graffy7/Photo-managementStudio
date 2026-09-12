namespace StudioManagement.Business.Settings;

public interface IStudioSettingsService
{
    Task<BusinessSettingsDto> GetBusinessSettingsAsync(int studioId, CancellationToken ct = default);
    Task<BusinessSettingsDto> UpdateBusinessSettingsAsync(int studioId, BusinessSettingsDto request, CancellationToken ct = default);

    Task<NotificationSettingsDto> GetNotificationSettingsAsync(int studioId, CancellationToken ct = default);
    Task<NotificationSettingsDto> UpdateNotificationSettingsAsync(int studioId, NotificationSettingsDto request, CancellationToken ct = default);

    Task<QuotationSettingsDto> GetQuotationSettingsAsync(int studioId, CancellationToken ct = default);
    Task<QuotationSettingsDto> UpdateQuotationSettingsAsync(int studioId, QuotationSettingsDto request, CancellationToken ct = default);

    // Used by NotificationService to gate a single notification type without the caller needing
    // to know the underlying settings-key mapping. Types with no matching toggle default to enabled.
    Task<bool> IsNotificationEnabledAsync(int studioId, string notificationType, CancellationToken ct = default);
}
