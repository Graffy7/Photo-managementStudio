namespace StudioManagement.Business.WhatsApp;

public interface IWhatsAppReminderService
{
    // What the hourly job calls: every active studio, only from the configured reminder time on.
    Task<WhatsAppRunResult> SendDueRemindersForAllStudiosAsync(DateTime localNow, CancellationToken ct = default);

    // One studio. ignoreTime = the owner pressed "send now", so the reminder-time gate is skipped
    // (already-sent reminders are still never repeated).
    Task<WhatsAppRunResult> SendRemindersForStudioAsync(int studioId, DateTime localNow, bool ignoreTime, CancellationToken ct = default);

    // The "Test Event Reminder" tool: builds both messages for tomorrow (or one chosen event) and shows
    // them separately with who would get each. Null when the chosen event isn't in this studio.
    Task<ReminderPreviewDto?> PreviewAsync(int studioId, DateTime localNow, TestReminderRequestDto request, CancellationToken ct = default);
}
