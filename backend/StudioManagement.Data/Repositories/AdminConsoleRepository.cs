using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class AdminConsoleRepository(AppDbContext context) : IAdminConsoleRepository
{
    public Task<List<Studio>> GetStudiosAsync(CancellationToken ct = default) =>
        context.Studios.AsNoTracking().OrderBy(s => s.StudioName).ToListAsync(ct);

    public Task<List<StudioSubscription>> GetSubscriptionsAsync(int? studioId = null, CancellationToken ct = default) =>
        context.StudioSubscriptions.AsNoTracking()
            .Include(s => s.SubscriptionPlan)
            .Where(s => studioId == null || s.StudioId == studioId)
            .ToListAsync(ct);

    public Task<List<SubscriptionPayment>> GetPaymentsAsync(int? studioId = null, CancellationToken ct = default) =>
        context.SubscriptionPayments.AsNoTracking()
            .Include(p => p.StudioSubscription).ThenInclude(s => s.SubscriptionPlan)
            .Where(p => studioId == null || p.StudioSubscription.StudioId == studioId)
            .OrderByDescending(p => p.PaymentDate)
            .ToListAsync(ct);

    public Task<List<PhotoFileRef>> GetPhotoFilesAsync(int? studioId = null, CancellationToken ct = default) =>
        context.Photos.AsNoTracking()
            .Where(p => studioId == null || p.Gallery.StudioId == studioId)
            .Select(p => new PhotoFileRef(p.Gallery.StudioId, p.SourceFolder ?? p.Gallery.SourceFolder, p.SourceRelativePath, p.PreviewPath, p.ThumbnailPath))
            .ToListAsync(ct);

    public async Task<StudioRecordCounts> GetCountsAsync(int studioId, CancellationToken ct = default)
    {
        // Sequential: one DbContext can't run queries in parallel.
        var customers = await context.Customers.CountAsync(x => x.StudioId == studioId, ct);
        var events = await context.Events.CountAsync(x => x.StudioId == studioId, ct);
        var leads = await context.Leads.CountAsync(x => x.StudioId == studioId, ct);
        var quotations = await context.Quotations.CountAsync(x => x.StudioId == studioId, ct);
        var payments = await context.Payments.CountAsync(x => x.StudioId == studioId, ct);
        var workers = await context.Workers.CountAsync(x => x.StudioId == studioId, ct);
        var expenses = await context.Expenses.CountAsync(x => x.StudioId == studioId, ct);
        var galleries = await context.PhotoGalleries.CountAsync(x => x.StudioId == studioId, ct);
        var photos = await context.Photos.CountAsync(x => x.Gallery.StudioId == studioId, ct);
        var submitted = await context.PhotoGalleries.CountAsync(x => x.StudioId == studioId && x.SubmittedAt != null, ct);
        var selected = await context.PhotoSelections.CountAsync(x => x.Gallery.StudioId == studioId, ct);
        var whatsApp = await context.WhatsAppReminderLogs.CountAsync(x => x.StudioId == studioId && x.Status == "Sent", ct);
        var delivered = await context.EventDeliveryItems.CountAsync(x => x.StudioId == studioId && x.IsDelivered, ct);

        return new StudioRecordCounts(customers, events, leads, quotations, payments, workers, expenses,
            galleries, photos, submitted, selected, whatsApp, delivered);
    }

    public async Task<(List<ActivityRow> Items, int TotalCount)> SearchActivityAsync(ActivityQuery q, CancellationToken ct = default)
    {
        var query =
            from a in context.AuditLogs.AsNoTracking()
            join s in context.Studios on a.StudioId equals s.StudioId into studios
            from s in studios.DefaultIfEmpty()
            join u in context.Users on a.UserId equals u.UserId into users
            from u in users.DefaultIfEmpty()
            select new { a, StudioName = s != null ? s.StudioName : null, UserName = u != null ? u.FullName : null, UserType = u != null ? u.UserType : null };

        if (q.StudioId is not null) query = query.Where(x => x.a.StudioId == q.StudioId);
        if (q.From is not null) query = query.Where(x => x.a.CreatedAt >= q.From);
        if (q.To is not null) query = query.Where(x => x.a.CreatedAt < q.To);
        if (!string.IsNullOrWhiteSpace(q.Module)) query = query.Where(x => x.a.Module == q.Module);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            query = query.Where(x => x.a.Action.Contains(term) || (x.StudioName != null && x.StudioName.Contains(term)) || (x.UserName != null && x.UserName.Contains(term)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.a.CreatedAt).ThenByDescending(x => x.a.AuditLogId)
            .Skip((q.Page - 1) * q.PageSize).Take(q.PageSize)
            .Select(x => new ActivityRow(x.a.AuditLogId, x.a.CreatedAt, x.a.StudioId, x.StudioName, x.a.Module, x.a.Action,
                x.a.UserId, x.UserName, x.UserType, x.a.IpAddress, x.a.Device))
            .ToListAsync(ct);

        return (items, total);
    }

    public Task<List<string>> GetActivityModulesAsync(int? studioId = null, CancellationToken ct = default) =>
        context.AuditLogs.AsNoTracking()
            .Where(a => studioId == null || a.StudioId == studioId)
            .Select(a => a.Module).Distinct().OrderBy(m => m)
            .ToListAsync(ct);
}
