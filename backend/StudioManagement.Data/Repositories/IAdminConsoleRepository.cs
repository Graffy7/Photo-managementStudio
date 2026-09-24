using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

// Where a studio's photo files live: the original (on the studio's own disk) and the app's
// preview/thumbnail copies.
public record PhotoFileRef(int StudioId, string? OriginalFolder, string RelativePath, string? PreviewPath, string? ThumbnailPath);

public record StudioRecordCounts(
    int Customers, int Events, int Leads, int Quotations, int Payments, int Workers, int Expenses,
    int Galleries, int Photos, int SelectionsSubmitted, int SelectedPhotos, int WhatsAppSent, int DeliveredItems);

public record ActivityRow(
    long AuditLogId, DateTime CreatedAt, int? StudioId, string? StudioName, string Module, string Action,
    int? UserId, string? UserName, string? UserType, string? IpAddress, string? Device);

public record ActivityQuery(int? StudioId, DateTime? From, DateTime? To, string? Module, string? Search, int Page, int PageSize);

// Read-only queries behind the platform admin's console. Platform-wide by design (the admin sees
// every studio), so nothing here is tenant-scoped.
public interface IAdminConsoleRepository
{
    Task<List<Studio>> GetStudiosAsync(CancellationToken ct = default);
    Task<List<StudioSubscription>> GetSubscriptionsAsync(int? studioId = null, CancellationToken ct = default);
    Task<List<SubscriptionPayment>> GetPaymentsAsync(int? studioId = null, CancellationToken ct = default);
    Task<List<PhotoFileRef>> GetPhotoFilesAsync(int? studioId = null, CancellationToken ct = default);
    Task<StudioRecordCounts> GetCountsAsync(int studioId, CancellationToken ct = default);
    Task<(List<ActivityRow> Items, int TotalCount)> SearchActivityAsync(ActivityQuery query, CancellationToken ct = default);
    Task<List<string>> GetActivityModulesAsync(int? studioId = null, CancellationToken ct = default);
}
