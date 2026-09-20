using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class WhatsAppReminderLogRepository(AppDbContext context) : IWhatsAppReminderLogRepository
{
    public Task<List<WhatsAppReminderLog>> GetForDayAsync(int studioId, DateTime reminderDate, CancellationToken ct = default) =>
        context.WhatsAppReminderLogs.Where(l => l.StudioId == studioId && l.ReminderDate == reminderDate.Date).ToListAsync(ct);

    public async Task AddAsync(WhatsAppReminderLog log, CancellationToken ct = default) =>
        await context.WhatsAppReminderLogs.AddAsync(log, ct);
}
