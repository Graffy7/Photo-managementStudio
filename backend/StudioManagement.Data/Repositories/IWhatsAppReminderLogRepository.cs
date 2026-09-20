using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IWhatsAppReminderLogRepository
{
    // Tracked, so a status change is saved with the unit of work.
    Task<List<WhatsAppReminderLog>> GetForDayAsync(int studioId, DateTime reminderDate, CancellationToken ct = default);
    Task AddAsync(WhatsAppReminderLog log, CancellationToken ct = default);
}
