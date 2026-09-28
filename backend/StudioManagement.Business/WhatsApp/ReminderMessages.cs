using System.Globalization;
using System.Text;

namespace StudioManagement.Business.WhatsApp;

// ============================================================================================
// MESSAGE 1 — Function Details (to the studio owner). Operational information ONLY. This type has no field for an amount,
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
// MESSAGE 2 — Payment Details. OWNER ONLY. Never built for, or sent to, a worker.
// ============================================================================================

public sealed class PaymentReminderMessage
{
    public string CustomerName { get; init; } = "";
    public string EventName { get; init; } = "Event";
    public DateTime EventDate { get; init; }
    public string CurrencySymbol { get; init; } = "₹";

    // Null when no total has been set for the event.
    public decimal? TotalAmount { get; init; }
    // Advance taken at booking (part of PaidAmount), and everything paid so far.
    public decimal AdvancePaid { get; init; }
    public decimal PaidAmount { get; init; }

    public decimal? Balance => TotalAmount is null ? null : Math.Max(0, TotalAmount.Value - PaidAmount);
    public bool IsFullyPaid => TotalAmount is not null && TotalAmount.Value - PaidAmount <= 0;
}

public static class ReminderTextFormat
{
    private static readonly CultureInfo India = new("en-IN");
    private const string Rule = "━━━━━━━━━━━━━━";

    public const string TestBanner = "🧪 TEST MESSAGE — not a real reminder";

    public static string Date(DateTime date) => date.ToString("d MMMM yyyy", CultureInfo.InvariantCulture);

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

// "Priya Wedding": the client's name and the kind of function, as the studio says it.
public static class FunctionName
{
    public static string Of(string customerName, string eventName) =>
        string.IsNullOrWhiteSpace(eventName) || eventName == "Event" ? customerName.Trim() : $"{customerName.Trim()} {eventName.Trim()}";
}

// MESSAGE 1 - Function Details, to the studio owner. Built only from EventReminderMessage, which has
// no money fields. Template "function_details" placeholders, in order: {{1}} function, {{2}} client,
// {{3}} client number, {{4}} date, {{5}} time, {{6}} location, {{7}} photographers.
public static class FunctionDetailsMessage
{
    public static IReadOnlyList<string> Parameters(EventReminderMessage e) =>
    [
        FunctionName.Of(e.CustomerName, e.EventName),
        e.CustomerName,
        string.IsNullOrWhiteSpace(e.CustomerPhone) ? "Not given" : e.CustomerPhone.Trim(),
        ReminderTextFormat.Date(e.EventDate),
        ReminderTextFormat.TimeRange(e.StartTime, e.EndTime),
        Location(e),
        e.Team.Count == 0 ? "Not assigned yet" : string.Join(", ", e.Team.Select(t => t.Name))
    ];

    public static string Build(EventReminderMessage e, bool isTest = false)
    {
        var p = Parameters(e);
        var sb = new StringBuilder();
        if (isTest) sb.AppendLine(ReminderTextFormat.TestBanner).AppendLine();
        sb.AppendLine("📸 Function Details");
        sb.AppendLine($"Function: {p[0]}");
        sb.AppendLine($"Client: {p[1]}");
        sb.AppendLine($"Client No: {p[2]}");
        sb.AppendLine($"Date: {p[3]}");
        sb.AppendLine($"Time: {p[4]}");
        sb.AppendLine($"Location: {p[5]}");
        sb.Append($"Photographer: {p[6]}");
        return sb.ToString();
    }

    private static string Location(EventReminderMessage e)
    {
        var parts = new[] { e.Venue, IsLink(e.Address) ? null : e.Address }
            .Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x!.Trim()).ToList();
        return parts.Count == 0 ? "Not specified" : string.Join(", ", parts);
    }

    private static bool IsLink(string? value) =>
        value is not null && (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || value.StartsWith("https://", StringComparison.OrdinalIgnoreCase));
}

// MESSAGE 2 - Payment Details, to the studio owner ONLY. Template "payment_details" placeholders, in
// order: {{1}} function, {{2}} client, {{3}} total amount, {{4}} advance paid, {{5}} total paid, {{6}} balance.
public static class PaymentDetailsMessage
{
    public static IReadOnlyList<string> Parameters(PaymentReminderMessage p) =>
    [
        FunctionName.Of(p.CustomerName, p.EventName),
        p.CustomerName,
        p.TotalAmount is { } total ? ReminderTextFormat.Money(total, p.CurrencySymbol) : "Not set",
        ReminderTextFormat.Money(p.AdvancePaid, p.CurrencySymbol),
        ReminderTextFormat.Money(p.PaidAmount, p.CurrencySymbol),
        p.Balance is { } balance ? ReminderTextFormat.Money(balance, p.CurrencySymbol) : "Not set"
    ];

    public static string Build(PaymentReminderMessage p, bool isTest = false)
    {
        var v = Parameters(p);
        var sb = new StringBuilder();
        if (isTest) sb.AppendLine(ReminderTextFormat.TestBanner).AppendLine();
        sb.AppendLine("💰 Payment Details");
        sb.AppendLine($"Function: {v[0]}");
        sb.AppendLine($"Client: {v[1]}");
        sb.AppendLine($"Total Amount: {v[2]}");
        sb.AppendLine($"Advance Paid: {v[3]}");
        sb.AppendLine($"Total Paid: {v[4]}");
        sb.Append($"Balance: {v[5]}");
        return sb.ToString();
    }
}
