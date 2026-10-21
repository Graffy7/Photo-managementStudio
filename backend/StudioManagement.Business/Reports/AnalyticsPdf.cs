using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using StudioManagement.Business.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Reports;

public interface IAnalyticsPdfService
{
    Task<byte[]> GenerateAsync(int studioId, AnalyticsReportDto report, CancellationToken ct = default);
}

// The Reports page as a printable PDF (A4 landscape): the period, the summary figures, insights, the
// day/month table, event types, statuses, profit by event and expenses by category - exactly the
// figures of the report it is given, nothing recalculated. Counts and amounts only.
public class AnalyticsPdfService(IStudioRepository studioRepository) : IAnalyticsPdfService
{
    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");
    private static readonly Color Accent = Color.FromHex("#1F4E79");
    private static readonly Color Muted = Colors.Grey.Darken1;
    private static readonly Color Line = Colors.Grey.Lighten2;
    private static readonly Color Good = Color.FromHex("#1E7B4F");
    private static readonly Color Bad = Color.FromHex("#B3261E");
    private static readonly Color Plain = Colors.Grey.Darken4;

    // The PDF font has no rupee sign, so amounts are written "Rs." (as on quotations).
    private static string Money(decimal v) => (v < 0 ? "-" : "") + "Rs. " + Math.Abs(v).ToString("N0", India);
    private static string Count(int v) => v.ToString("N0", India);
    private static string Day(DateTime d) => d.ToString("d MMM yyyy", India);

    public async Task<byte[]> GenerateAsync(int studioId, AnalyticsReportDto r, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        return Compose(studio?.StudioName ?? "Studio", r, BusinessClock.Now).GeneratePdf();
    }

    // The document itself (also rendered to page images when checking the layout).
    public static IDocument Compose(string studioName, AnalyticsReportDto r, DateTime generated)
    {
        var unit = r.Grouping == nameof(DateGrouping.Day) ? "day" : "month";

        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4.Landscape());
            page.Margin(28);
            page.DefaultTextStyle(x => x.FontSize(9).FontColor(Colors.Grey.Darken3));

            page.Header().PaddingBottom(10).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text(studioName).FontSize(16).Bold().FontColor(Accent);
                    c.Item().Text("Business report").FontSize(11).SemiBold();
                });
                row.RelativeItem().AlignRight().Column(c =>
                {
                    c.Item().AlignRight().Text($"{Day(r.RangeStart)} - {Day(r.RangeLastDay)}").FontSize(11).Bold();
                    c.Item().AlignRight().Text($"Both dates included · by {unit}").FontColor(Muted);
                    c.Item().AlignRight().Text($"Generated {generated.ToString("d MMM yyyy, h:mm tt", India)}").FontSize(8).FontColor(Muted);
                });
            });

            page.Content().Column(col =>
            {
                col.Spacing(14);

                // Summary figures: counts on one line, money on the next.
                var s = r.Summary;
                col.Item().Element(e => Tiles(e, new (string, string, Color)[]
                {
                    ("New bookings", Count(s.NewBookings), Plain), ("Events", Count(s.Events), Plain), ("Completed", Count(s.Completed), Good),
                    ("Cancelled", Count(s.Cancelled), s.Cancelled > 0 ? Bad : Plain), ("Pending", Count(s.Pending), Plain)
                }));
                col.Item().Element(e => Tiles(e, new (string, string, Color)[]
                {
                    ("Event value", Money(s.EventValue), Plain), ("Money received", Money(s.MoneyReceived), Good),
                    ("Expenses", Money(s.Expenses), s.Expenses > 0 ? Bad : Plain), ("Profit", Money(s.Profit), s.Profit < 0 ? Bad : Good),
                    ("Customers owe", Money(s.CustomersOwe), Plain)
                }));
                col.Item().Text("New bookings count by booking date; events by event date; money received and expenses by their own dates. Profit = money received minus expenses.")
                    .FontSize(8).FontColor(Muted);

                if (r.Insights.Count > 0)
                {
                    col.Item().Element(e => Section(e, "Business insights", c =>
                    {
                        foreach (var line in r.Insights)
                        {
                            c.Item().Text("•  " + line.Replace("₹", "Rs. "));
                        }
                    }));
                }

                col.Item().Element(e => Section(e, $"By {unit}", c => c.Item().Table(t =>
                {
                    t.ColumnsDefinition(d =>
                    {
                        d.RelativeColumn(1.4f);
                        for (var i = 0; i < 5; i++) d.RelativeColumn(1);
                        for (var i = 0; i < 4; i++) d.RelativeColumn(1.4f);
                    });
                    Head(t, unit == "day" ? "Date" : "Month", "New bookings", "Events", "Completed", "Cancelled", "Pending", "Event value", "Received", "Expenses", "Profit");
                    var zebra = false;
                    foreach (var b in r.Buckets)
                    {
                        zebra = !zebra;
                        Cells(t, zebra, false, b.Label, Count(b.NewBookings), Count(b.Events), Count(b.Completed), Count(b.Cancelled), Count(b.Pending),
                            Money(b.EventValue), Money(b.MoneyReceived), Money(b.Expenses), Money(b.Profit));
                    }
                    Cells(t, false, true, "Total", Count(s.NewBookings), Count(s.Events), Count(s.Completed), Count(s.Cancelled), Count(s.Pending),
                        Money(s.EventValue), Money(s.MoneyReceived), Money(s.Expenses), Money(s.Profit));
                })));

                col.Item().Row(row =>
                {
                    row.Spacing(14);
                    row.RelativeItem(3).Element(e => Section(e, "Event types", c =>
                    {
                        if (r.EventTypes.Count == 0)
                        {
                            c.Item().Text("No events dated in this period.").FontColor(Muted);
                            return;
                        }
                        c.Item().Table(t =>
                        {
                            t.ColumnsDefinition(d =>
                            {
                                d.RelativeColumn(2);
                                for (var i = 0; i < 4; i++) d.RelativeColumn(1);
                                d.RelativeColumn(1.5f);
                                d.RelativeColumn(1.5f);
                            });
                            Head(t, "Type", "Events", "Completed", "Cancelled", "Pending", "Event value", "Received");
                            var zebra = false;
                            foreach (var x in r.EventTypes)
                            {
                                zebra = !zebra;
                                Cells(t, zebra, false, x.Name, Count(x.Events), Count(x.Completed), Count(x.Cancelled), Count(x.Pending), Money(x.EventValue), Money(x.Received));
                            }
                        });
                    }));
                    row.RelativeItem(1).Element(e => Section(e, "Status of events", c => c.Item().Table(t =>
                    {
                        t.ColumnsDefinition(d => { d.RelativeColumn(2); d.RelativeColumn(1); });
                        Head(t, "Status", "Events");
                        var zebra = false;
                        foreach (var x in r.Statuses)
                        {
                            zebra = !zebra;
                            Cells(t, zebra, false, x.Status, Count(x.Count));
                        }
                        Cells(t, false, true, "Total", Count(s.Events));
                    })));
                });

                var p = r.Profit;
                col.Item().Element(e => Section(e, "Profit by event", c =>
                {
                    c.Item().Text("The event's agreed total minus its expenses, whether or not the customer has paid yet.").FontSize(8).FontColor(Muted);
                    if (p.Events.Count == 0)
                    {
                        c.Item().Text("No events dated in this period.").FontColor(Muted);
                        return;
                    }
                    c.Item().Table(t =>
                    {
                        t.ColumnsDefinition(d =>
                        {
                            d.RelativeColumn(1.1f);
                            d.RelativeColumn(2.2f);
                            for (var i = 0; i < 5; i++) d.RelativeColumn(1.3f);
                        });
                        Head(t, "Date", "Customer", "Event total", "Expenses", "Profit", "Received", "Customer owes");
                        var zebra = false;
                        foreach (var x in p.Events)
                        {
                            zebra = !zebra;
                            Cells(t, zebra, false, Day(x.EventDate), x.CustomerName + (string.IsNullOrWhiteSpace(x.Venue) ? "" : $" · {x.Venue}"),
                                Money(x.EventTotal), Money(x.Expenses), Money(x.NetProfit), Money(x.CollectedRevenue), Money(x.OutstandingBalance));
                        }
                        Cells(t, false, true, "Total", $"{Count(p.Events.Count)} events", Money(p.EventsTotalAmount), Money(p.EventsExpenses),
                            Money(p.EventsNetProfit), Money(p.Events.Sum(x => x.CollectedRevenue)), Money(p.EventsOutstandingBalance));
                    });
                }));

                if (p.ExpensesByCategory.Count > 0)
                {
                    col.Item().Element(e => Section(e, "Expenses by category", c => c.Item().Table(t =>
                    {
                        t.ColumnsDefinition(d => { d.RelativeColumn(3); d.RelativeColumn(1); });
                        Head(t, "Category", "Amount");
                        var zebra = false;
                        foreach (var x in p.ExpensesByCategory)
                        {
                            zebra = !zebra;
                            Cells(t, zebra, false, x.CategoryName, Money(x.TotalAmount));
                        }
                        Cells(t, false, true, "Total", Money(p.ExpensesByCategory.Sum(x => x.TotalAmount)));
                    })));
                }
            });

            page.Footer().AlignCenter().Text(x =>
            {
                x.DefaultTextStyle(t => t.FontSize(8).FontColor(Muted));
                x.Span($"{studioName} · Business report · Page ");
                x.CurrentPageNumber();
                x.Span(" of ");
                x.TotalPages();
            });
        }));
    }

    private static void Tiles(IContainer container, (string Label, string Value, Color Tone)[] tiles)
    {
        container.Row(row =>
        {
            row.Spacing(8);
            foreach (var (label, value, tone) in tiles)
            {
                row.RelativeItem().Border(1).BorderColor(Line).Background(Colors.Grey.Lighten5).Padding(8).Column(c =>
                {
                    c.Item().Text(label).FontSize(8).FontColor(Muted);
                    c.Item().Text(value).FontSize(13).Bold().FontColor(tone);
                });
            }
        });
    }

    private static void Section(IContainer container, string title, Action<ColumnDescriptor> body)
    {
        container.Column(c =>
        {
            c.Spacing(5);
            c.Item().Text(title).FontSize(11).Bold().FontColor(Accent);
            body(c);
        });
    }

    private static void Head(TableDescriptor t, params string[] titles)
    {
        t.Header(h =>
        {
            for (var i = 0; i < titles.Length; i++)
            {
                var cell = h.Cell().Background(Accent).PaddingVertical(4).PaddingHorizontal(5);
                (i == 0 || titles[i] is "Customer" or "Type" or "Category" or "Status" ? cell : cell.AlignRight())
                    .Text(titles[i]).FontSize(8).Bold().FontColor(Colors.White);
            }
        });
    }

    // First column left-aligned (and the second when it is text), the rest right-aligned.
    private static void Cells(TableDescriptor t, bool zebra, bool total, params string[] values)
    {
        for (var i = 0; i < values.Length; i++)
        {
            var cell = t.Cell().Background(total ? Colors.Grey.Lighten3 : zebra ? Colors.Grey.Lighten5 : Colors.White)
                .BorderBottom(0.5f).BorderColor(Line).PaddingVertical(3).PaddingHorizontal(5);
            var leftAligned = i == 0 || (i == 1 && !LooksNumeric(values[i]));
            var text = (leftAligned ? cell : cell.AlignRight()).Text(values[i]);
            if (total) text.Bold();
        }
    }

    private static bool LooksNumeric(string value) => value.StartsWith("Rs.") || value.StartsWith("-Rs.") || value.All(ch => char.IsDigit(ch) || ch == ',');
}
