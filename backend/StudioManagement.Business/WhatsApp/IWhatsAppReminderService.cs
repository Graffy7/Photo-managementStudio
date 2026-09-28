namespace StudioManagement.Business.WhatsApp;

public interface IWhatsAppReminderService
{
    // What the 15-minute job calls: every active studio; each function's two owner messages go once,
    // HoursBefore (24h) before it starts.
    Task<WhatsAppRunResult> SendDueRemindersForAllStudiosAsync(DateTime localNow, CancellationToken ct = default);

    // One studio. ignoreTime = the owner pressed "send now": functions starting within the next
    // HoursBefore + 24 hours go now (already-sent messages are still never repeated).
    Task<WhatsAppRunResult> SendRemindersForStudioAsync(int studioId, DateTime localNow, bool ignoreTime, CancellationToken ct = default);

    // The "Test Event Reminder" tool: builds both messages for the upcoming functions (or one chosen
    // event) and shows them separately, owner only. Null when the chosen event isn't in this studio.
    Task<ReminderPreviewDto?> PreviewAsync(int studioId, DateTime localNow, TestReminderRequestDto request, CancellationToken ct = default);
}
