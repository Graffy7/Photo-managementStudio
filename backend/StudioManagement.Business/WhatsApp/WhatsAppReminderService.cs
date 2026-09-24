using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Features;
using StudioManagement.Business.Settings;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.WhatsApp;

// Sends the day-before reminders as TWO independent messages with completely separate recipients:
//
//   Message 1 (event / worker)  -> the studio owner AND each assigned worker (only their own events).
//                                  Built from EventReminderMessage, which has no money fields at all.
//   Message 2 (payment)         -> the studio owner ONLY. Worker phone numbers never enter this path,
//                                  and payment data is only loaded inside it.
//
// Each (event, day, message kind, recipient) has one row in WhatsAppReminderLogs: that is what makes a
// repeated scheduler run harmless, and what lets one failed recipient be retried without touching
// anyone else's delivery.
public partial class WhatsAppReminderService(
    IEventRepository eventRepository,
    IPaymentRepository paymentRepository,
    IStudioRepository studioRepository,
    IWhatsAppReminderLogRepository logRepository,
    IStudioSettingsService settingsService,
    IFeatureService featureService,
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

    public async Task<WhatsAppRunResult> SendRemindersForStudioAsync(int studioId, DateTime localNow, bool ignoreTime, CancellationToken ct = default)
    {
        await RunLock.WaitAsync(ct);
        try
        {
            var result = new WhatsAppRunResult();

            // Switched off for this studio by the platform admin, or by the studio itself.
            if (!await featureService.IsEnabledAsync(studioId, FeatureCodes.WhatsApp, ct))
            {
                return result;
            }

            var notifications = await settingsService.GetNotificationSettingsAsync(studioId, ct);
            if (!notifications.WhatsAppNotification)
            {
                return result;
            }
            if (!ignoreTime && localNow.TimeOfDay < options.ReminderTimeOfDay)
            {
                return result;
            }

            var day = localNow.Date.AddDays(1);
            var events = await eventRepository.GetForReminderAsync(studioId, day, day.AddDays(1), null, ct);
            if (events.Count == 0)
            {
                return result;
            }

            var studio = await studioRepository.GetByIdAsync(studioId, ct);
            if (studio is null)
            {
                return result;
            }

            var logs = await logRepository.GetForDayAsync(studioId, day, ct);
            var owner = new Recipient(WhatsAppRecipientTypes.Owner, null, studio.OwnerName ?? "Owner",
                WhatsAppPhone.Normalize(studio.PhoneNumber, options.DefaultCountryCode));

            // MESSAGE 1 — owner + assigned workers. No payment data is loaded or referenced here.
            if (notifications.EventReminder)
            {
                await SendEventMessageAsync(studioId, day, owner, events, logs, result, ct);

                if (notifications.WorkerEventNotification)
                {
                    foreach (var (worker, workerEvents) in AssignedWorkers(events))
                    {
                        await SendEventMessageAsync(studioId, day, worker, workerEvents, logs, result, ct);
                    }
                }
            }

            // MESSAGE 2 — the owner only. A separate delivery: a failure above changes nothing here.
            if (notifications.PaymentReminder)
            {
                await SendPaymentMessageAsync(studioId, day, owner, events, logs, result, ct);
            }

            return result;
        }
        finally
        {
            RunLock.Release();
        }
    }

    // ---- Message 1: event / worker -----------------------------------------------------------

    private async Task SendEventMessageAsync(
        int studioId, DateTime day, Recipient recipient, List<Event> candidateEvents,
        List<WhatsAppReminderLog> logs, WhatsAppRunResult result, CancellationToken ct)
    {
        var pending = candidateEvents
            .Where(e => IsPending(Find(logs, e.EventId, WhatsAppReminderTypes.TomorrowEvent, recipient.Key)))
            .ToList();
        if (pending.Count == 0)
        {
            return;
        }

        var text = EventReminderMessageBuilder.Build(pending.Select(ToEventMessage).ToList());
        await DeliverAsync(studioId, day, WhatsAppReminderTypes.TomorrowEvent, recipient, pending.Select(e => e.EventId).ToList(), text, logs, result, ct);
    }

    // Each active worker assigned to any of the events, with ONLY the events they are assigned to.
    private IEnumerable<(Recipient Worker, List<Event> Events)> AssignedWorkers(List<Event> events)
    {
        var byWorker = new Dictionary<int, (Recipient Worker, List<Event> Events)>();
        foreach (var e in events)
        {
            foreach (var worker in e.EventWorkers.Select(ew => ew.Worker).Where(w => w.IsActive).DistinctBy(w => w.WorkerId))
            {
                if (!byWorker.TryGetValue(worker.WorkerId, out var entry))
                {
                    entry = (new Recipient(WhatsAppRecipientTypes.Worker, worker.WorkerId, worker.FullName,
                        WhatsAppPhone.Normalize(worker.MobileNumber, options.DefaultCountryCode)), []);
                    byWorker[worker.WorkerId] = entry;
                }
                entry.Events.Add(e);
            }
        }

        return byWorker.Values;
    }

    // ---- Message 2: payment, owner only ------------------------------------------------------

    private async Task SendPaymentMessageAsync(
        int studioId, DateTime day, Recipient owner, List<Event> events,
        List<WhatsAppReminderLog> logs, WhatsAppRunResult result, CancellationToken ct)
    {
        var pending = events
            .Where(e => IsPending(Find(logs, e.EventId, WhatsAppReminderTypes.TomorrowPayment, OwnerKey)))
            .ToList();
        if (pending.Count == 0)
        {
            return;
        }

        var payments = await BuildPaymentMessagesAsync(studioId, pending, ct);
        var text = PaymentReminderMessageBuilder.Build(payments);
        await DeliverAsync(studioId, day, WhatsAppReminderTypes.TomorrowPayment, owner, pending.Select(e => e.EventId).ToList(), text, logs, result, ct);
    }

    private async Task<List<PaymentReminderMessage>> BuildPaymentMessagesAsync(int studioId, List<Event> events, CancellationToken ct)
    {
        var paid = (await paymentRepository.GetCompletedTotalsByEventIdsAsync(studioId, events.Select(e => e.EventId).ToList(), ct))
            .ToDictionary(x => x.EventId, x => x.TotalPaid);
        var symbol = ReminderTextFormat.CurrencySymbol((await settingsService.GetBusinessSettingsAsync(studioId, ct)).Currency);

        return events.Select(e => new PaymentReminderMessage
        {
            CustomerName = e.Customer.FullName,
            EventName = e.EventType?.Name ?? "Event",
            EventDate = e.EventDate,
            CurrencySymbol = symbol,
            TotalAmount = e.Budget,
            PaidAmount = paid.GetValueOrDefault(e.EventId)
        }).ToList();
    }

    // ---- Delivery and the log ----------------------------------------------------------------

    private async Task DeliverAsync(
        int studioId, DateTime day, string reminderType, Recipient recipient, List<int> eventIds, string text,
        List<WhatsAppReminderLog> logs, WhatsAppRunResult result, CancellationToken ct)
    {
        var rows = new List<WhatsAppReminderLog>();
        foreach (var eventId in eventIds)
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
            send = await sender.SendAsync(recipient.Phone, text, ct);
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
        var day = localNow.Date.AddDays(1);
        var events = await eventRepository.GetForReminderAsync(studioId, day, day.AddDays(1), request.EventId, ct);
        if (request.EventId is not null && events.Count == 0)
        {
            return null;
        }
        if (events.Count > 0)
        {
            day = events[0].EventDate.Date;
        }

        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        if (studio is null)
        {
            return null;
        }

        var notifications = await settingsService.GetNotificationSettingsAsync(studioId, ct);
        var ownerPhone = WhatsAppPhone.Normalize(studio.PhoneNumber, options.DefaultCountryCode);
        var ownerName = studio.OwnerName ?? "Studio owner";

        var eventText = events.Count == 0 ? "" : EventReminderMessageBuilder.Build(events.Select(ToEventMessage).ToList(), isTest: true);
        var paymentText = events.Count == 0 ? "" : PaymentReminderMessageBuilder.Build(await BuildPaymentMessagesAsync(studioId, events, ct), isTest: true);

        var warnings = new List<string>();
        if (events.Count == 0)
        {
            warnings.Add("There are no events tomorrow, so there is nothing to preview. Pick a specific event to preview it.");
        }
        if (!notifications.WhatsAppNotification)
        {
            warnings.Add("WhatsApp notifications are switched off in Settings, so real reminders are not being sent.");
        }
        if (options.Provider != WhatsAppOptions.CloudApiProvider)
        {
            warnings.Add("No WhatsApp provider is connected yet: messages are only written to the server log, not delivered.");
        }
        if (ownerPhone is null)
        {
            warnings.Add("The studio owner's phone number isn't set (Settings → Studio profile), so nothing can be sent to the owner.");
        }

        // Message 1 recipients: the owner and every worker assigned to a previewed event.
        var eventRecipients = new List<ReminderRecipientDto>
        {
            new()
            {
                Name = ownerName, Kind = WhatsAppRecipientTypes.Owner, Phone = studio.PhoneNumber, EventCount = events.Count,
                WillReceive = events.Count > 0 && ownerPhone is not null && notifications.WhatsAppNotification && notifications.EventReminder,
                Note = ownerPhone is null ? "Owner phone number not configured." : !notifications.EventReminder ? "Event reminders are switched off." : null
            }
        };

        var allWorkers = events.SelectMany(e => e.EventWorkers.Select(ew => (ew.Worker, Event: e)))
            .GroupBy(x => x.Worker.WorkerId);
        foreach (var group in allWorkers)
        {
            var worker = group.First().Worker;
            var phone = WhatsAppPhone.Normalize(worker.MobileNumber, options.DefaultCountryCode);
            var note = !worker.IsActive ? "Worker is inactive — not sent."
                : phone is null ? "Worker phone number not configured."
                : !notifications.WorkerEventNotification ? "Worker notifications are switched off."
                : null;

            eventRecipients.Add(new ReminderRecipientDto
            {
                Name = worker.FullName, Kind = WhatsAppRecipientTypes.Worker, Phone = worker.MobileNumber, EventCount = group.Count(),
                WillReceive = note is null && notifications.WhatsAppNotification && notifications.EventReminder,
                Note = note
            });
        }

        // Message 2: the owner, and nobody else. There is no code path that adds a worker here.
        var paymentRecipients = new List<ReminderRecipientDto>
        {
            new()
            {
                Name = ownerName, Kind = WhatsAppRecipientTypes.Owner, Phone = studio.PhoneNumber, EventCount = events.Count,
                WillReceive = events.Count > 0 && ownerPhone is not null && notifications.WhatsAppNotification && notifications.PaymentReminder,
                Note = ownerPhone is null ? "Owner phone number not configured." : !notifications.PaymentReminder ? "Payment reminders are switched off." : null
            }
        };

        var preview = new ReminderPreviewDto
        {
            Date = day,
            EventCount = events.Count,
            Provider = options.Provider,
            Warnings = warnings,
            EventMessage = new ReminderMessagePreviewDto { Title = "MESSAGE 1 — EVENT/WORKER", Text = eventText, Recipients = eventRecipients },
            PaymentMessage = new ReminderMessagePreviewDto { Title = "MESSAGE 2 — OWNER PAYMENT", Text = paymentText, Recipients = paymentRecipients },
            Checks = new ReminderChecksDto
            {
                EventMessageHasNoPaymentInfo = !ContainsPaymentInfo(eventText),
                PaymentMessageIsOwnerOnly = paymentRecipients.All(r => r.Kind == WhatsAppRecipientTypes.Owner),
                WorkersReceivingPaymentMessage = paymentRecipients.Count(r => r.Kind == WhatsAppRecipientTypes.Worker)
            }
        };

        // Optionally deliver the two TEST messages — to the owner's own phone only.
        if (request.SendToOwner && events.Count > 0)
        {
            if (ownerPhone is null)
            {
                preview.SendResults.Add("Not sent: the owner's phone number isn't set.");
            }
            else
            {
                preview.SendResults.Add(await SendTestAsync("Message 1 (event) TEST", ownerPhone, eventText, ct));
                preview.SendResults.Add(await SendTestAsync("Message 2 (payment) TEST", ownerPhone, paymentText, ct));
            }
        }

        return preview;
    }

    private async Task<string> SendTestAsync(string label, string phone, string text, CancellationToken ct)
    {
        var send = await sender.SendAsync(phone, text, ct);
        return send.Success
            ? $"{label}: sent to the owner{(send.Simulated ? " (logged only — no provider connected)" : "")}."
            : $"{label}: failed — {send.Error}";
    }

    // The privacy check on the worker-facing message: no currency symbol and none of the payment words.
    private static bool ContainsPaymentInfo(string text) =>
        text.IndexOfAny(['₹', '$', '€', '£']) >= 0 ||
        PaymentWords().IsMatch(text);

    [GeneratedRegex(@"\b(total|paid|balance|payment|amount|pending|advance)\b", RegexOptions.IgnoreCase)]
    private static partial Regex PaymentWords();
}
