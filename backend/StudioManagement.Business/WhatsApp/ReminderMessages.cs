using System.Globalization;
using System.Text;

namespace StudioManagement.Business.WhatsApp;

// ============================================================================================
// MESSAGE 1 — event / worker. Operational information ONLY. This type has no field for an amount,
// a payment or a balance, so nothing financial can be put into a message built from it.
// ============================================================================================

public record TeamMember(string Name, string? Role);

public sealed class EventReminderMessage
{
    public string CustomerName { get; init; } = "";
    public string? CustomerPhone { get; init; }
    public string EventName { get; init; } = "Event";
    public DateTime EventDate { get; init; }
    public TimeSpan? StartTime { get; init; }
    public TimeSpan? EndTime { get; init; }
    public string? Venue { get; init; }
    public string? Address { get; init; }

    // Only ever a link the system can back up: one stored with the event, or one generated from the
    // stored venue/address. Null when there's no location at all.
    public string? MapLink { get; init; }
    public IReadOnlyList<TeamMember> Team { get; init; } = [];
}

// ============================================================================================
// MESSAGE 2 — payment. OWNER ONLY. Never built for, or sent to, a worker.
// ============================================================================================

public sealed class PaymentReminderMessage
{
    public string CustomerName { get; init; } = "";
    public string EventName { get; init; } = "Event";
    public DateTime EventDate { get; init; }
    public string CurrencySymbol { get; init; } = "₹";

    // Null when no total has been set for the event.
    public decimal? TotalAmount { get; init; }
    public decimal PaidAmount { get; init; }

    public decimal? Balance => TotalAmount is null ? null : Math.Max(0, TotalAmount.Value - PaidAmount);
    public bool IsFullyPaid => TotalAmount is not null && TotalAmount.Value - PaidAmount <= 0;
}

public static class ReminderTextFormat
{
    private static readonly CultureInfo India = new("en-IN");
    private const string Rule = "━━━━━━━━━━━━━━";

    public const string TestBanner = "🧪 TEST MESSAGE — not a real reminder";

    public static string Date(DateTime date) => date.ToString("dddd, d MMMM yyyy", CultureInfo.InvariantCulture);

    public static string Time(TimeSpan time) => DateTime.Today.Add(time).ToString("h:mm tt", CultureInfo.InvariantCulture);

    public static string TimeRange(TimeSpan? start, TimeSpan? end) => (start, end) switch
    {
        ({ } s, { } e) => $"{Time(s)} - {Time(e)}",
        ({ } s, null) => Time(s),
        _ => "Not specified"
    };

    // 1️⃣ 2️⃣ … — each digit as a keycap emoji.
    public static string Number(int n) => string.Concat(n.ToString(CultureInfo.InvariantCulture).Select(d => $"{d}️⃣"));

    public static string Money(decimal amount, string symbol) =>
        symbol + amount.ToString(amount % 1 == 0 ? "N0" : "N2", India);

    public static string CurrencySymbol(string? code) => (code ?? "INR").ToUpperInvariant() switch
    {
        "INR" => "₹",
        "USD" => "$",
        "EUR" => "€",
        "GBP" => "£",
        var other => other + " "
    };

    public static string Divider => Rule;
}

public static class EventReminderMessageBuilder
{
    public static string Build(IReadOnlyList<EventReminderMessage> events, bool isTest = false)
    {
        var sb = new StringBuilder();
        if (isTest)
        {
            sb.AppendLine(ReminderTextFormat.TestBanner).AppendLine();
        }

        if (events.Count == 1)
        {
            AppendSingle(sb, events[0]);
        }
        else
        {
            AppendMany(sb, events);
        }

        return sb.ToString().TrimEnd();
    }

    private static void AppendSingle(StringBuilder sb, EventReminderMessage e)
    {
        sb.AppendLine("📸 TOMORROW'S EVENT");
        sb.AppendLine($"🎉 {e.EventName}");
        sb.AppendLine($"👤 Customer: {e.CustomerName}");
        if (!string.IsNullOrWhiteSpace(e.CustomerPhone))
        {
            sb.AppendLine($"📞 Customer Phone: {e.CustomerPhone}");
        }
        sb.AppendLine($"📅 Date: {ReminderTextFormat.Date(e.EventDate)}");
        sb.AppendLine($"⏰ Time: {ReminderTextFormat.TimeRange(e.StartTime, e.EndTime)}");

        if (!string.IsNullOrWhiteSpace(e.Venue) || !string.IsNullOrWhiteSpace(e.Address))
        {
            sb.AppendLine("📍 Location:");
            if (!string.IsNullOrWhiteSpace(e.Venue))
            {
                sb.AppendLine(e.Venue.Trim());
            }
            if (!string.IsNullOrWhiteSpace(e.Address) && !IsLink(e.Address))
            {
                sb.AppendLine(e.Address.Trim());
            }
        }
        if (!string.IsNullOrWhiteSpace(e.MapLink))
        {
            sb.AppendLine("🗺️ Open Location:");
            sb.AppendLine(e.MapLink);
        }

        sb.AppendLine();
        sb.AppendLine("👥 ASSIGNED TEAM");
        AppendTeam(sb, e.Team);
        sb.AppendLine();
        sb.Append("Please be ready for tomorrow's event.");
    }

    private static void AppendMany(StringBuilder sb, IReadOnlyList<EventReminderMessage> events)
    {
        sb.AppendLine("📸 TOMORROW'S EVENTS");
        sb.AppendLine($"📅 {ReminderTextFormat.Date(events[0].EventDate)}");
        sb.AppendLine(ReminderTextFormat.Divider);

        for (var i = 0; i < events.Count; i++)
        {
            var e = events[i];
            sb.AppendLine($"{ReminderTextFormat.Number(i + 1)} {e.EventName.ToUpperInvariant()}");
            sb.AppendLine($"👤 Customer: {e.CustomerName}");
            if (!string.IsNullOrWhiteSpace(e.CustomerPhone))
            {
                sb.AppendLine($"📞 Customer Phone: {e.CustomerPhone}");
            }
            sb.AppendLine($"⏰ {ReminderTextFormat.TimeRange(e.StartTime, e.EndTime)}");

            var place = string.Join(", ", new[] { e.Venue, IsLink(e.Address) ? null : e.Address }.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));
            if (place.Length > 0)
            {
                sb.AppendLine($"📍 {place}");
            }
            if (!string.IsNullOrWhiteSpace(e.MapLink))
            {
                sb.AppendLine($"🗺️ Open Location: {e.MapLink}");
            }

            sb.AppendLine("👥 Team:");
            AppendTeam(sb, e.Team);
            sb.AppendLine(ReminderTextFormat.Divider);
        }

        sb.Append("Please be ready for tomorrow's events.");
    }

    private static void AppendTeam(StringBuilder sb, IReadOnlyList<TeamMember> team)
    {
        if (team.Count == 0)
        {
            sb.AppendLine("• No team assigned yet");
            return;
        }

        foreach (var member in team)
        {
            sb.AppendLine(string.IsNullOrWhiteSpace(member.Role) ? $"• {member.Name}" : $"• {member.Name} - {member.Role}");
        }
    }

    private static bool IsLink(string? value) =>
        value is not null && (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || value.StartsWith("https://", StringComparison.OrdinalIgnoreCase));
}

public static class PaymentReminderMessageBuilder
{
    public static string Build(IReadOnlyList<PaymentReminderMessage> payments, bool isTest = false)
    {
        var sb = new StringBuilder();
        if (isTest)
        {
            sb.AppendLine(ReminderTextFormat.TestBanner).AppendLine();
        }

        if (payments.Count == 1)
        {
            var p = payments[0];
            sb.AppendLine("💰 TOMORROW'S EVENT — PAYMENT");
            sb.AppendLine($"🎉 Event: {p.EventName}");
            sb.AppendLine($"👤 Customer: {p.CustomerName}");
            sb.AppendLine($"💰 Total Amount: {Total(p)}");
            sb.AppendLine($"💵 Paid: {ReminderTextFormat.Money(p.PaidAmount, p.CurrencySymbol)}");
            if (p.Balance is { } balance)
            {
                sb.AppendLine($"⚠️ Balance: {ReminderTextFormat.Money(balance, p.CurrencySymbol)}");
            }
            sb.Append($"Status: {StatusText(p)}");
            return sb.ToString();
        }

        sb.AppendLine("💰 TOMORROW'S PAYMENT SUMMARY");
        sb.AppendLine(ReminderTextFormat.Divider);
        for (var i = 0; i < payments.Count; i++)
        {
            var p = payments[i];
            sb.AppendLine($"{ReminderTextFormat.Number(i + 1)} {p.EventName}");
            sb.AppendLine($"Customer: {p.CustomerName}");
            sb.AppendLine($"Total: {Total(p)}");
            sb.AppendLine($"Paid: {ReminderTextFormat.Money(p.PaidAmount, p.CurrencySymbol)}");
            if (p.Balance is { } balance)
            {
                sb.AppendLine($"Balance: {ReminderTextFormat.Money(balance, p.CurrencySymbol)}");
            }
            sb.AppendLine(p.TotalAmount is null ? "⚠️ Total not set" : p.IsFullyPaid ? "✅ Fully Paid" : "⚠️ Balance Pending");
            sb.AppendLine(ReminderTextFormat.Divider);
        }

        return sb.ToString().TrimEnd();
    }

    private static string Total(PaymentReminderMessage p) =>
        p.TotalAmount is { } total ? ReminderTextFormat.Money(total, p.CurrencySymbol) : "Not set";

    private static string StatusText(PaymentReminderMessage p) =>
        p.TotalAmount is null ? "Total not set" : p.IsFullyPaid ? "Fully Paid" : "Balance Pending";
}
