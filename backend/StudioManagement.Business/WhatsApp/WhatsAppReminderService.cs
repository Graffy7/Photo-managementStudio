using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Billing;
using StudioManagement.Business.Features;
using StudioManagement.Business.Settings;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.WhatsApp;

// Sends the studio owner two SEPARATE WhatsApp messages for each function, 24 hours before it starts:
//
//   Message 1 (Function Details) -> the studio owner's registered number. Built from EventReminderMessage,
//                                   which has no money fields at all.
//   Message 2 (Payment Details)  -> the studio owner's registered number, and nobody else.
//
// Nothing is sent to workers. Each (function, message) has one row in WhatsAppReminderLogs: that is
// what stops a repeated run from sending twice, and what lets a failed delivery be retried.
public partial class WhatsAppReminderService(
    IEventRepository eventRepository,
    IPaymentRepository paymentRepository,
    IStudioRepository studioRepository,
    IWhatsAppReminderLogRepository logRepository,
    IStudioSettingsService settingsService,
    IFeatureService featureService,
    IStudioAccessService accessService,
    IWhatsAppSender sender,
    WhatsAppOptions options,
    IUnitOfWork unitOfWork,
    ILogger<WhatsAppReminderService> logger) : IWhatsAppReminderService
{
    // The service uses one scoped DbContext and the delivery log has a unique index: two runs at once
    // in this process (the hourly job and an owner pressing "send now") take turns.
    private static readonly SemaphoreSlim RunLock = new(1, 1);

    private const string OwnerKey = "owner";

    private sealed record Recipient(string Kind, int? WorkerId, string Name, string? Phone)
    {
        public string Key => Kind == WhatsAppRecipientTypes.Owner ? OwnerKey : $"worker:{WorkerId}";
    }

    // ---- Scheduler entry points --------------------------------------------------------------

    public async Task<WhatsAppRunResult> SendDueRemindersForAllStudiosAsync(DateTime localNow, CancellationToken ct = default)
    {
        var total = new WhatsAppRunResult();
        foreach (var studioId in await studioRepository.GetActiveStudioIdsAsync(ct))
        {
            try
            {
                total.Add(await SendRemindersForStudioAsync(studioId, localNow, ignoreTime: false, ct));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // One studio's problem must not stop everyone else's reminders.
                logger.LogError(ex, "WhatsApp reminders failed for studio {StudioId}", studioId);
            }
        }

        return total;
    }

    // When a function's two messages are due: HoursBefore (24h) before it starts; for a function with no
    // start time, ReminderTime (09:00) on the day before.
    private DateTime DueAt(Event e) => e.StartTime is { } start
        ? e.EventDate.Date.Add(start).AddHours(-options.HoursBefore)
        : e.EventDate.Date.AddDays(-1).Add(options.ReminderTimeOfDay);

    // After this nothing is sent any more (a missed reminder for a function that has begun is pointless).
    private static DateTime StartsAt(Event e) => e.EventDate.Date.Add(e.StartTime ?? new TimeSpan(23, 59, 0));

    // Functions from today up to the furthest one that can be due now.
    private Task<List<Event>> LoadUpcomingAsync(int studioId, DateTime localNow, int? eventId, CancellationToken ct) =>
        eventRepository.GetForReminderAsync(studioId, localNow.Date, localNow.Date.AddDays(options.HoursBefore / 24 + 3), eventId, ct);

    public async Task<WhatsAppRunResult> SendRemindersForStudioAsync(int studioId, DateTime localNow, bool ignoreTime, CancellationToken ct = default)
    {
        await RunLock.WaitAsync(ct);
        try
        {
            var result = new WhatsAppRunResult();

            // Switched off for this studio by the platform admin, or by the studio itself.
            if (!await featureService.IsEnabledAsync(studioId, FeatureCodes.WhatsApp, ct) ||
                !(await accessService.GetAsync(studioId, ct)).HasAccess)
            {
                return result;
            }

            var notifications = await settingsService.GetNotificationSettingsAsync(studioId, ct);
            if (!notifications.WhatsAppNotification || (!notifications.EventReminder && !notifications.PaymentReminder))
            {
                return result;
            }

            // Due now: its 24-hour mark has passed and it hasn't started. "Send now" (ignoreTime) also
            // takes anything starting within the next HoursBefore + 24 hours.
            var due = (await LoadUpcomingAsync(studioId, localNow, null, ct))
                .Where(e => e.EventStatus != EventStatuses.Completed && StartsAt(e) > localNow)
                .Where(e => localNow >= DueAt(e) || (ignoreTime && StartsAt(e) <= localNow.AddHours(options.HoursBefore + 24)))
                .ToList();
            if (due.Count == 0)
            {
                return result;
            }

            var studio = await studioRepository.GetByIdAsync(studioId, ct);
            if (studio is null)
            {
                return result;
            }

            var owner = new Recipient(WhatsAppRecipientTypes.Owner, null, studio.OwnerName ?? "Owner",
                WhatsAppPhone.Normalize(studio.PhoneNumber, options.DefaultCountryCode));

            var logs = new List<WhatsAppReminderLog>();
            foreach (var day in due.Select(e => e.EventDate.Date).Distinct())
            {
                logs.AddRange(await logRepository.GetForDayAsync(studioId, day, ct));
            }

            var payments = notifications.PaymentReminder
                ? (await BuildPaymentMessagesAsync(studioId, due, ct))
                : [];

            foreach (var e in due)
            {
                // MESSAGE 1 - Function Details. No payment data is loaded or referenced here.
                if (notifications.EventReminder && IsPending(Find(logs, e.EventId, WhatsAppReminderTypes.TomorrowEvent, OwnerKey)))
                {
                    var message = ToEventMessage(e);
                    await DeliverAsync(studioId, e.EventDate.Date, WhatsAppReminderTypes.TomorrowEvent, owner, e.EventId,
                        FunctionDetailsMessage.Build(message), Template(options.FunctionDetailsTemplate, FunctionDetailsMessage.Parameters(message)),
                        logs, result, ct);
                }

                // MESSAGE 2 - Payment Details, the owner only. A separate delivery: a failure above
                // changes nothing here.
                if (notifications.PaymentReminder && IsPending(Find(logs, e.EventId, WhatsAppReminderTypes.TomorrowPayment, OwnerKey)))
                {
                    var payment = payments[e.EventId];
                    await DeliverAsync(studioId, e.EventDate.Date, WhatsAppReminderTypes.TomorrowPayment, owner, e.EventId,
                        PaymentDetailsMessage.Build(payment), Template(options.PaymentDetailsTemplate, PaymentDetailsMessage.Parameters(payment)),
                        logs, result, ct);
                }
            }

            return result;
        }
        finally
        {
            RunLock.Release();
        }
    }

    private static WhatsAppTemplate? Template(string name, IReadOnlyList<string> parameters) =>
        string.IsNullOrWhiteSpace(name) ? null : new WhatsAppTemplate(name.Trim(), parameters);

    private async Task<Dictionary<int, PaymentReminderMessage>> BuildPaymentMessagesAsync(int studioId, List<Event> events, CancellationToken ct)
    {
        var ids = events.Select(e => e.EventId).ToList();
        var paid = (await paymentRepository.GetCompletedTotalsByEventIdsAsync(studioId, ids, ct)).ToDictionary(x => x.EventId, x => x.TotalPaid);
        var advance = await paymentRepository.GetCompletedAdvanceTotalsByEventIdsAsync(studioId, ids, ct);
        var symbol = ReminderTextFormat.CurrencySymbol((await settingsService.GetBusinessSettingsAsync(studioId, ct)).Currency);

        return events.ToDictionary(e => e.EventId, e => new PaymentReminderMessage
        {
            CustomerName = e.Customer.FullName,
            EventName = e.EventType?.Name ?? "Event",
            EventDate = e.EventDate,
            CurrencySymbol = symbol,
            TotalAmount = e.Budget,
            AdvancePaid = advance.GetValueOrDefault(e.EventId),
            PaidAmount = paid.GetValueOrDefault(e.EventId)
        });
    }

    // ---- Delivery and the log ----------------------------------------------------------------

    private async Task DeliverAsync(
        int studioId, DateTime day, string reminderType, Recipient recipient, int eventId, string text, WhatsAppTemplate? template,
        List<WhatsAppReminderLog> logs, WhatsAppRunResult result, CancellationToken ct)
    {
        var rows = new List<WhatsAppReminderLog>();
        {
            var row = Find(logs, eventId, reminderType, recipient.Key);
            if (row is null)
            {
                row = new WhatsAppReminderLog
                {
                    StudioId = studioId,
                    EventId = eventId,
                    ReminderDate = day.Date,
                    ReminderType = reminderType,
                    RecipientType = recipient.Kind,
                    WorkerId = recipient.WorkerId,
                    RecipientKey = recipient.Key,
                    Status = WhatsAppLogStatuses.Skipped,
                    CreatedAt = DateTime.UtcNow
                };
                await logRepository.AddAsync(row, ct);
                logs.Add(row);
            }
            rows.Add(row);
        }

        var now = DateTime.UtcNow;

        if (recipient.Phone is null)
        {
            var reason = recipient.Kind == WhatsAppRecipientTypes.Owner ? "Owner phone number not configured." : "Worker phone number not configured.";
            logger.LogWarning("WhatsApp {Type} skipped for {Kind} {Name}: {Reason}", reminderType, recipient.Kind, recipient.Name, reason);
            foreach (var row in rows)
            {
                row.Status = WhatsAppLogStatuses.Skipped;
                row.Detail = reason;
                row.UpdatedAt = now;
            }

            await SaveAsync(ct);
            result.Skipped++;
            return;
        }

        WhatsAppSendResult send;
        try
        {
            send = await sender.SendAsync(recipient.Phone, text, ct, template);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "WhatsApp {Type} to {Kind} {Name} threw", reminderType, recipient.Kind, recipient.Name);
            send = new WhatsAppSendResult(false, "Unexpected error while sending.");
        }

        foreach (var row in rows)
        {
            row.Attempts++;
            row.UpdatedAt = now;
            if (send.Success)
            {
                row.Status = WhatsAppLogStatuses.Sent;
                row.SentAt = now;
                row.Detail = send.Simulated ? "Logged only — no WhatsApp provider is configured." : null;
            }
            else
            {
                row.Status = WhatsAppLogStatuses.Failed;
                row.Detail = Truncate(send.Error ?? "Sending failed.", 500);
            }
        }

        await SaveAsync(ct);
        if (send.Success)
        {
            result.Sent++;
        }
        else
        {
            result.Failed++;
        }
    }

    private async Task SaveAsync(CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            // The unique index refused a duplicate row: another run already recorded this reminder.
            logger.LogWarning(ex, "Couldn't record a WhatsApp reminder (probably already recorded)");
        }
    }

    private WhatsAppReminderLog? Find(List<WhatsAppReminderLog> logs, int eventId, string type, string key) =>
        logs.FirstOrDefault(l => l.EventId == eventId && l.ReminderType == type && l.RecipientKey == key);

    // Sent is final. A failure is retried until MaxAttempts; a skipped one (no phone number yet) is
    // looked at again on every run, in case the number has since been added.
    private bool IsPending(WhatsAppReminderLog? log) => log is null || log.Status switch
    {
        WhatsAppLogStatuses.Sent => false,
        WhatsAppLogStatuses.Failed => log.Attempts < options.MaxAttempts,
        _ => true
    };

    // ---- Message content ---------------------------------------------------------------------

    private static EventReminderMessage ToEventMessage(Event e) => new()
    {
        CustomerName = e.Customer.FullName,
        CustomerPhone = e.Customer.MobileNumber,
        EventName = e.EventType?.Name ?? "Event",
        EventDate = e.EventDate,
        StartTime = e.StartTime,
        EndTime = e.EndTime,
        Venue = e.Venue,
        Address = e.VenueAddress,
        MapLink = BuildMapLink(e.Venue, e.VenueAddress),
        Team = e.EventWorkers.Select(ew => ew.Worker).DistinctBy(w => w.WorkerId)
            .Select(w => new TeamMember(w.FullName, w.WorkerType?.Name)).ToList()
    };

    // A link the system can stand behind: the stored one if the address IS a link, otherwise a Google
    // Maps search for the stored venue/address. Nothing stored, no link.
    private static string? BuildMapLink(string? venue, string? address)
    {
        if (address is not null && (address.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || address.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
        {
            return address.Trim();
        }

        var place = string.Join(", ", new[] { venue, address }.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));
        return place.Length == 0 ? null : "https://www.google.com/maps/search/?api=1&query=" + Uri.EscapeDataString(place);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];

    // ---- The test tool -----------------------------------------------------------------------

    public async Task<ReminderPreviewDto?> PreviewAsync(int studioId, DateTime localNow, TestReminderRequestDto request, CancellationToken ct = default)
    {
        // One chosen function, or the upcoming ones that haven't started yet.
        var events = (await LoadUpcomingAsync(studioId, localNow, request.EventId, ct))
            .Where(e => request.EventId is not null || StartsAt(e) > localNow)
            .ToList();
        if (request.EventId is not null && events.Count == 0)
        {
            return null;
        }

        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        var notifications = await settingsService.GetNotificationSettingsAsync(studioId, ct);
        var ownerPhone = WhatsAppPhone.Normalize(studio.PhoneNumber, options.DefaultCountryCode);
        var ownerName = studio.OwnerName ?? "Studio owner";
        var payments = events.Count == 0 ? [] : await BuildPaymentMessagesAsync(studioId, events, ct);

        const string between = "\n\n━━━━━━━━━━━━━━\n\n";
        var eventText = string.Join(between, events.Select(e => FunctionDetailsMessage.Build(ToEventMessage(e), isTest: true)));
        var paymentText = string.Join(between, events.Select(e => PaymentDetailsMessage.Build(payments[e.EventId], isTest: true)));

        var warnings = new List<string>();
        if (events.Count == 0)
        {
            warnings.Add("There are no upcoming functions in the next few days, so there is nothing to preview. Pick a specific event to preview it.");
        }
        else if (request.EventId is null)
        {
            warnings.Add($"Each function's messages go to the owner {options.HoursBefore} hours before it starts.");
        }
        if (!notifications.WhatsAppNotification)
        {
            warnings.Add("WhatsApp notifications are switched off in Settings, so real messages are not being sent.");
        }
        if (options.Provider != WhatsAppOptions.CloudApiProvider)
        {
            warnings.Add("No WhatsApp provider is connected yet: messages are only written to the server log, not delivered.");
        }
        if (ownerPhone is null)
        {
            warnings.Add("The studio owner's phone number isn't set (Settings → Studio profile), so nothing can be sent.");
        }

        // Both messages: the owner, and nobody else. There is no code path that adds a worker.
        ReminderRecipientDto Owner(bool enabled, string offNote) => new()
        {
            Name = ownerName, Kind = WhatsAppRecipientTypes.Owner, Phone = studio.PhoneNumber, EventCount = events.Count,
            WillReceive = events.Count > 0 && ownerPhone is not null && notifications.WhatsAppNotification && enabled,
            Note = ownerPhone is null ? "Owner phone number not configured." : !enabled ? offNote : null
        };
        var eventRecipients = new List<ReminderRecipientDto> { Owner(notifications.EventReminder, "Function details are switched off.") };
        var paymentRecipients = new List<ReminderRecipientDto> { Owner(notifications.PaymentReminder, "Payment details are switched off.") };

        var preview = new ReminderPreviewDto
        {
            Date = events.Count > 0 ? events[0].EventDate.Date : localNow.Date.AddDays(1),
            EventCount = events.Count,
            Provider = options.Provider,
            Warnings = warnings,
            EventMessage = new ReminderMessagePreviewDto { Title = "MESSAGE 1 — FUNCTION DETAILS (owner)", Text = eventText, Recipients = eventRecipients },
            PaymentMessage = new ReminderMessagePreviewDto { Title = "MESSAGE 2 — PAYMENT DETAILS (owner only)", Text = paymentText, Recipients = paymentRecipients },
            Checks = new ReminderChecksDto
            {
                EventMessageHasNoPaymentInfo = !ContainsPaymentInfo(eventText),
                PaymentMessageIsOwnerOnly = paymentRecipients.All(r => r.Kind == WhatsAppRecipientTypes.Owner),
                WorkersReceivingPaymentMessage = 0
            }
        };

        // Optionally deliver the TEST messages - to the owner's own phone only.
        if (request.SendToOwner && events.Count > 0)
        {
            if (ownerPhone is null)
            {
                preview.SendResults.Add("Not sent: the owner's phone number isn't set.");
            }
            else
            {
                foreach (var e in events.Take(3))
                {
                    var message = ToEventMessage(e);
                    preview.SendResults.Add(await SendTestAsync($"Function Details TEST ({FunctionName.Of(message.CustomerName, message.EventName)})", ownerPhone,
                        FunctionDetailsMessage.Build(message, isTest: true), Template(options.FunctionDetailsTemplate, FunctionDetailsMessage.Parameters(message)), ct));
                    preview.SendResults.Add(await SendTestAsync("Payment Details TEST", ownerPhone,
                        PaymentDetailsMessage.Build(payments[e.EventId], isTest: true), Template(options.PaymentDetailsTemplate, PaymentDetailsMessage.Parameters(payments[e.EventId])), ct));
                }
            }
        }

        return preview;
    }

    private async Task<string> SendTestAsync(string label, string phone, string text, WhatsAppTemplate? template, CancellationToken ct)
    {
        var send = await sender.SendAsync(phone, text, ct, template);
        return send.Success
            ? $"{label}: sent to the owner{(send.Simulated ? " (logged only — no provider connected)" : "")}."
            : $"{label}: failed — {send.Error}";
    }

    // The privacy check on the Function Details message: no currency symbol and none of the payment words.
    private static bool ContainsPaymentInfo(string text) =>
        text.IndexOfAny(['₹', '$', '€', '£']) >= 0 ||
        PaymentWords().IsMatch(text);

    [GeneratedRegex(@"\b(total|paid|balance|payment|amount|pending|advance)\b", RegexOptions.IgnoreCase)]
    private static partial Regex PaymentWords();
}
