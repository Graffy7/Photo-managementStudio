using System.Globalization;
using System.Text;
using StudioManagement.Business.Common;
using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Reports;

// The studio's analytics for one date range. Every figure is an exact count or amount from the
// stored records, and every part of the report covers exactly the same range. Date definitions:
//  - New bookings: events created (booked) in the range, by the studio's local date.
//  - Events / Completed / Cancelled / Pending: events whose event date is in the range, by status
//    (Pending = Upcoming, Ongoing or an older Confirmed).
//  - Event value: agreed totals of the events dated in the range, cancelled ones left out.
//  - Money received: received payments dated in the range. Expenses: expenses dated in the range.
//  - Profit: money received minus expenses. Customers owe: what is still unpaid on the
//    non-cancelled events dated in the range.
public class AnalyticsFigures
{
    public int NewBookings { get; set; }
    public int Events { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int Pending { get; set; }
    public decimal EventValue { get; set; }
    public decimal MoneyReceived { get; set; }
    public decimal Expenses { get; set; }
    public decimal Profit { get; set; }
}

public class AnalyticsSummaryDto : AnalyticsFigures
{
    public decimal CustomersOwe { get; set; }
    public decimal CancelledValue { get; set; }
}

// One day or one month of the range (only the part inside the range).
public class AnalyticsBucketDto : AnalyticsFigures
{
    public DateTime Start { get; set; }
    public DateTime LastDay { get; set; }
    public string Label { get; set; } = null!;
}

public class AnalyticsEventTypeDto
{
    public string Name { get; set; } = null!;
    public int Events { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int Pending { get; set; }
    public decimal EventValue { get; set; }
    public decimal Received { get; set; }
}

public class AnalyticsStatusDto
{
    public string Status { get; set; } = null!;
    public int Count { get; set; }
}

public class AnalyticsReportDto
{
    public DateTime RangeStart { get; set; }
    // The last day included (the range is inclusive of both dates shown).
    public DateTime RangeLastDay { get; set; }
    public string Grouping { get; set; } = null!;
    public AnalyticsSummaryDto Summary { get; set; } = new();
    public List<AnalyticsBucketDto> Buckets { get; set; } = [];
    public List<AnalyticsEventTypeDto> EventTypes { get; set; } = [];
    public List<AnalyticsStatusDto> Statuses { get; set; } = [];
    public List<string> Insights { get; set; } = [];
    // The profit-by-event and expense-category breakdown for the same range.
    public ProfitReportDto Profit { get; set; } = null!;
}

public interface IAnalyticsReportService
{
    Task<AnalyticsReportDto> GetAsync(int studioId, DateRangePreset preset, DateTime? customStart, DateTime? customEnd, CancellationToken ct = default);
}

public class AnalyticsReportService(
    IAnalyticsReportRepository repository,
    IProfitReportService profitReportService,
    IUnitOfWork unitOfWork) : IAnalyticsReportService
{
    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");

    private static bool IsPending(string status) =>
        status is EventStatuses.Upcoming or EventStatuses.Ongoing or EventStatuses.Confirmed;

    public async Task<AnalyticsReportDto> GetAsync(int studioId, DateRangePreset preset, DateTime? customStart, DateTime? customEnd, CancellationToken ct = default)
    {
        var range = DateRange.Resolve(preset, customStart, customEnd);
        var grouping = DateRange.GroupingFor(preset, range);

        // All queries see the same instant, so the cards, charts and table always agree.
        var (events, bookings, payments, expenses) = await unitOfWork.ExecuteInSnapshotAsync(async t => (
            await repository.GetEventsDatedAsync(studioId, range.Start, range.End, t),
            await repository.GetBookingTimesAsync(studioId, range.StartUtc, range.EndUtc, t),
            await repository.GetPaymentsAsync(studioId, range.Start, range.End, t),
            await repository.GetExpensesAsync(studioId, range.Start, range.End, t)), ct);
        var profit = await profitReportService.GetProfitReportAsync(studioId, preset, customStart, customEnd, ct);

        // Booking times are UTC; the studio's own calendar day decides which day/month they count in.
        var bookingDays = bookings.Select(b => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(b, DateTimeKind.Utc), BusinessClock.Zone).Date).ToList();

        var buckets = BuildBuckets(range, grouping);
        int Index(DateTime day)
        {
            var d = day.Date;
            for (var i = 0; i < buckets.Count; i++)
            {
                if (d >= buckets[i].Start && d <= buckets[i].LastDay) return i;
            }
            return -1;
        }

        foreach (var day in bookingDays)
        {
            var i = Index(day);
            if (i >= 0) buckets[i].NewBookings++;
        }
        foreach (var e in events)
        {
            var i = Index(e.EventDate);
            if (i < 0) continue;
            var b = buckets[i];
            b.Events++;
            if (e.Status == EventStatuses.Completed) b.Completed++;
            else if (e.Status == EventStatuses.Cancelled) b.Cancelled++;
            else if (IsPending(e.Status)) b.Pending++;
            if (e.Status != EventStatuses.Cancelled) b.EventValue += e.Value;
        }
        foreach (var p in payments)
        {
            var i = Index(p.Date);
            if (i >= 0) buckets[i].MoneyReceived += p.Amount;
        }
        foreach (var x in expenses)
        {
            var i = Index(x.Date);
            if (i >= 0) buckets[i].Expenses += x.Amount;
        }
        foreach (var b in buckets) b.Profit = b.MoneyReceived - b.Expenses;

        var live = events.Where(e => e.Status != EventStatuses.Cancelled).ToList();
        var summary = new AnalyticsSummaryDto
        {
            NewBookings = buckets.Sum(b => b.NewBookings),
            Events = events.Count,
            Completed = events.Count(e => e.Status == EventStatuses.Completed),
            Cancelled = events.Count(e => e.Status == EventStatuses.Cancelled),
            Pending = events.Count(e => IsPending(e.Status)),
            EventValue = live.Sum(e => e.Value),
            MoneyReceived = payments.Sum(p => p.Amount),
            Expenses = expenses.Sum(x => x.Amount),
            CustomersOwe = live.Sum(e => Math.Max(0, e.Value - e.Received)),
            CancelledValue = events.Where(e => e.Status == EventStatuses.Cancelled).Sum(e => e.Value)
        };
        summary.Profit = summary.MoneyReceived - summary.Expenses;

        var eventTypes = events
            .GroupBy(e => string.IsNullOrWhiteSpace(e.EventTypeName) ? "No event type" : e.EventTypeName!)
            .Select(g => new AnalyticsEventTypeDto
            {
                Name = g.Key,
                Events = g.Count(),
                Completed = g.Count(e => e.Status == EventStatuses.Completed),
                Cancelled = g.Count(e => e.Status == EventStatuses.Cancelled),
                Pending = g.Count(e => IsPending(e.Status)),
                EventValue = g.Where(e => e.Status != EventStatuses.Cancelled).Sum(e => e.Value),
                Received = g.Sum(e => e.Received)
            })
            .OrderByDescending(t => t.Events).ThenByDescending(t => t.EventValue).ThenBy(t => t.Name)
            .ToList();

        var statusOrder = new[] { EventStatuses.Upcoming, EventStatuses.Ongoing, EventStatuses.Confirmed, EventStatuses.Completed, EventStatuses.Cancelled };
        var statuses = statusOrder
            .Select(s => new AnalyticsStatusDto { Status = s, Count = events.Count(e => e.Status == s) })
            .Where(s => s.Count > 0 || s.Status != EventStatuses.Confirmed)
            .ToList();

        return new AnalyticsReportDto
        {
            RangeStart = range.Start,
            RangeLastDay = range.End.AddDays(-1),
            Grouping = grouping.ToString(),
            Summary = summary,
            Buckets = buckets,
            EventTypes = eventTypes,
            Statuses = statuses,
            Insights = BuildInsights(summary, buckets, eventTypes, expenses, grouping),
            Profit = profit
        };
    }

    // Every day (or month) of the range, including ones with no activity, so charts stay continuous.
    private static List<AnalyticsBucketDto> BuildBuckets(DateRange range, DateGrouping grouping)
    {
        var list = new List<AnalyticsBucketDto>();
        var lastDay = range.End.AddDays(-1).Date;
        if (grouping == DateGrouping.Day)
        {
            for (var d = range.Start.Date; d <= lastDay; d = d.AddDays(1))
            {
                list.Add(new AnalyticsBucketDto { Start = d, LastDay = d, Label = d.ToString("d MMM", India) });
            }
            return list;
        }

        var monthStart = new DateTime(range.Start.Year, range.Start.Month, 1);
        while (monthStart <= lastDay)
        {
            var start = monthStart < range.Start.Date ? range.Start.Date : monthStart;
            var end = monthStart.AddMonths(1).AddDays(-1);
            if (end > lastDay) end = lastDay;
            list.Add(new AnalyticsBucketDto { Start = start, LastDay = end, Label = monthStart.ToString("MMM yyyy", India) });
            monthStart = monthStart.AddMonths(1);
        }
        return list;
    }

    private static string Rupees(decimal value) => (value < 0 ? "-" : "") + "₹" + Math.Abs(value).ToString("N0", India);

    private static string Plural(int n, string one, string many) => $"{n} {(n == 1 ? one : many)}";

    // Plain statements built from the figures above - counts and amounts only.
    private static List<string> BuildInsights(AnalyticsSummaryDto s, List<AnalyticsBucketDto> buckets, List<AnalyticsEventTypeDto> types,
        List<AnalyticsMoneyRow> expenses, DateGrouping grouping)
    {
        var unit = grouping == DateGrouping.Day ? "day" : "month";
        var list = new List<string>();
        if (s.Events == 0 && s.NewBookings == 0 && s.MoneyReceived == 0 && s.Expenses == 0)
        {
            list.Add("Nothing was recorded in this period.");
            return list;
        }

        var busiest = buckets.OrderByDescending(b => b.Events).ThenBy(b => b.Start).FirstOrDefault();
        if (busiest is { Events: > 0 })
        {
            list.Add($"Busiest {unit}: {busiest.Label} with {Plural(busiest.Events, "event", "events")}.");
        }
        var bookedMost = buckets.OrderByDescending(b => b.NewBookings).ThenBy(b => b.Start).FirstOrDefault();
        if (bookedMost is { NewBookings: > 0 })
        {
            list.Add($"Most new bookings: {bookedMost.Label}, {Plural(bookedMost.NewBookings, "booking", "bookings")}.");
        }
        var topType = types.FirstOrDefault(t => t.Name != "No event type");
        if (topType is not null)
        {
            list.Add($"Most booked event type: {topType.Name} - {Plural(topType.Events, "event", "events")} worth {Rupees(topType.EventValue)}.");
        }
        var bestMoney = buckets.OrderByDescending(b => b.MoneyReceived).ThenBy(b => b.Start).FirstOrDefault();
        if (bestMoney is { MoneyReceived: > 0 })
        {
            list.Add($"Most money received: {bestMoney.Label}, {Rupees(bestMoney.MoneyReceived)}.");
        }
        var topCategory = expenses.GroupBy(x => x.Category ?? "Other")
            .Select(g => new { Name = g.Key, Amount = g.Sum(x => x.Amount) })
            .OrderByDescending(c => c.Amount).FirstOrDefault();
        if (topCategory is { Amount: > 0 })
        {
            list.Add($"Largest expense category: {topCategory.Name}, {Rupees(topCategory.Amount)}.");
        }
        if (s.Profit < 0)
        {
            list.Add($"Expenses were {Rupees(-s.Profit)} more than the money received.");
        }
        if (s.CustomersOwe > 0)
        {
            list.Add($"Customers still owe {Rupees(s.CustomersOwe)} for events in this period.");
        }
        if (s.Cancelled > 0)
        {
            list.Add($"{Plural(s.Cancelled, "event was", "events were")} cancelled, worth {Rupees(s.CancelledValue)}.");
        }
        if (s.Pending > 0)
        {
            list.Add($"{Plural(s.Pending, "event is", "events are")} still to happen in this period.");
        }
        return list;
    }
}

// The report as a CSV file: the period, the summary, the day/month table, event types and statuses.
public static class AnalyticsCsv
{
    public static byte[] Build(AnalyticsReportDto r)
    {
        var sb = new StringBuilder();
        void Row(params object?[] cells) => sb.AppendLine(string.Join(",", cells.Select(Cell)));

        Row("Report period", r.RangeStart.ToString("yyyy-MM-dd"), r.RangeLastDay.ToString("yyyy-MM-dd"));
        Row("Grouped by", r.Grouping);
        Row();
        Row("Summary");
        Row("New bookings", r.Summary.NewBookings);
        Row("Events", r.Summary.Events);
        Row("Completed", r.Summary.Completed);
        Row("Cancelled", r.Summary.Cancelled);
        Row("Pending", r.Summary.Pending);
        Row("Event value", r.Summary.EventValue);
        Row("Money received", r.Summary.MoneyReceived);
        Row("Expenses", r.Summary.Expenses);
        Row("Profit", r.Summary.Profit);
        Row("Customers owe", r.Summary.CustomersOwe);
        Row();
        Row(r.Grouping == nameof(DateGrouping.Day) ? "Date" : "Month", "From", "To", "New bookings", "Events", "Completed", "Cancelled", "Pending",
            "Event value", "Money received", "Expenses", "Profit");
        foreach (var b in r.Buckets)
        {
            Row(b.Label, b.Start.ToString("yyyy-MM-dd"), b.LastDay.ToString("yyyy-MM-dd"), b.NewBookings, b.Events, b.Completed, b.Cancelled, b.Pending,
                b.EventValue, b.MoneyReceived, b.Expenses, b.Profit);
        }
        Row();
        Row("Event type", "Events", "Completed", "Cancelled", "Pending", "Event value", "Money received");
        foreach (var t in r.EventTypes)
        {
            Row(t.Name, t.Events, t.Completed, t.Cancelled, t.Pending, t.EventValue, t.Received);
        }
        Row();
        Row("Status", "Events");
        foreach (var s in r.Statuses)
        {
            Row(s.Status, s.Count);
        }

        // BOM so Excel reads the ₹ and names correctly.
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
    }

    private static string Cell(object? value)
    {
        var text = value switch
        {
            null => "",
            decimal d => d.ToString("0.##", CultureInfo.InvariantCulture),
            IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
            _ => value.ToString() ?? ""
        };
        // A name starting with = + - @ would run as a formula in a spreadsheet.
        if (text.Length > 0 && "=+-@".Contains(text[0]) && value is string)
        {
            text = "'" + text;
        }
        return text.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? "\"" + text.Replace("\"", "\"\"") + "\"" : text;
    }
}
