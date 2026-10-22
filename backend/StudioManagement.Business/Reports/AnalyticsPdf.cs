using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using StudioManagement.Business.Common;
using StudioManagement.Business.Storage;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Reports;

public interface IAnalyticsPdfService
{
    Task<byte[]> GenerateAsync(int studioId, AnalyticsReportDto report, bool includeDetails, CancellationToken ct = default);
}

// The report as a PDF (A4 landscape). Page 1 is a one-page visual summary - 4 figures and 6 charts -
// readable at a glance. The detailed tables follow on separate pages only when asked for. Every
// figure comes from the report it is given; nothing is recalculated. Counts and amounts only.
public class AnalyticsPdfService(IStudioRepository studioRepository, IFileStorage fileStorage) : IAnalyticsPdfService
{
    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");
    private static readonly Color Ink = Color.FromHex("#14233A");
    private static readonly Color Accent = Color.FromHex("#1F4E79");
    private static readonly Color Muted = Color.FromHex("#6B7785");
    private static readonly Color Line = Color.FromHex("#E1E6ED");
    private static readonly Color Panel = Color.FromHex("#F6F8FB");

    // One colour per meaning, the same as on the Reports page.
    private const string Blue = "#2F7DD1", Green = "#2E9E6A", Orange = "#E8912D", Red = "#D9534F";
    private static readonly string[] TypeColors = ["#2F7DD1", "#7E62C9", "#2E9E6A", "#E8912D", "#D9534F", "#2BB3C4", "#D96BAF", "#8A99A8"];

    // The PDF font has no rupee sign, so amounts are written "Rs." (as on quotations).
    private static string Money(decimal v) => (v < 0 ? "-" : "") + "Rs. " + Math.Abs(v).ToString("N0", India);
    private static string Count(int v) => v.ToString("N0", India);
    private static string Day(DateTime d) => d.ToString("d MMM yyyy", India);

    // Compact amounts for chart scales and bar labels (exact amounts are in the card and the details).
    private static string Short(decimal v)
    {
        var a = Math.Abs(v);
        var t = a >= 10000000 ? $"{a / 10000000:0.#}Cr" : a >= 100000 ? $"{a / 100000:0.#}L" : a >= 10000 ? $"{a / 1000:0.#}K" : a.ToString("N0", India);
        return (v < 0 ? "-" : "") + t;
    }

    public async Task<byte[]> GenerateAsync(int studioId, AnalyticsReportDto r, bool includeDetails, CancellationToken ct = default)
    {
        var studio = await studioRepository.GetByIdAsync(studioId, ct);
        byte[]? logo = null;
        if (!string.IsNullOrWhiteSpace(studio?.LogoUrl))
        {
            try { logo = await fileStorage.ReadAsync(studio.LogoUrl, ct); } catch { logo = null; }
        }
        return Compose(studio?.StudioName ?? "Studio", logo, r, BusinessClock.Now, includeDetails).GeneratePdf();
    }

    // The document itself (also rendered to page images when checking the layout).
    public static IDocument Compose(string studioName, byte[]? logo, AnalyticsReportDto r, DateTime generated, bool includeDetails)
    {
        var unit = r.Grouping == nameof(DateGrouping.Day) ? "day" : "month";
        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                Setup(page, studioName, logo, r, unit, generated);
                page.Content().Element(c => Overview(c, r, unit));
            });
            if (includeDetails)
            {
                doc.Page(page =>
                {
                    Setup(page, studioName, logo, r, unit, generated);
                    page.Content().Element(c => Details(c, r, unit));
                });
            }
        });
    }

    private static void Setup(PageDescriptor page, string studioName, byte[]? logo, AnalyticsReportDto r, string unit, DateTime generated)
    {
        page.Size(PageSizes.A4.Landscape());
        page.Margin(24);
        page.DefaultTextStyle(x => x.FontSize(9).FontColor(Ink));
        page.Header().PaddingBottom(10).Row(row =>
        {
            if (logo is not null)
            {
                row.ConstantItem(34).Height(34).Image(logo).FitArea();
                row.ConstantItem(10);
            }
            row.RelativeItem().AlignMiddle().Column(c =>
            {
                c.Item().Text(studioName).FontSize(15).Bold().FontColor(Accent);
                c.Item().Text("Business Overview").FontSize(10).SemiBold().FontColor(Muted);
            });
            row.AutoItem().AlignMiddle().AlignRight().Column(c =>
            {
                c.Item().AlignRight().Text($"{Day(r.RangeStart)} - {Day(r.RangeLastDay)}").FontSize(11).Bold();
                c.Item().AlignRight().Text($"By {unit} · generated {generated.ToString("d MMM yyyy, h:mm tt", India)}").FontSize(7.5f).FontColor(Muted);
            });
        });
        page.Footer().AlignCenter().Text(x =>
        {
            x.DefaultTextStyle(t => t.FontSize(7.5f).FontColor(Muted));
            x.Span($"{studioName} · Business Overview · Page ");
            x.CurrentPageNumber();
            x.Span(" of ");
            x.TotalPages();
        });
    }

    private static string ChartLabel(AnalyticsBucketDto b, int i, string unit)
    {
        if (unit == "day") return i == 0 || b.Start.Day == 1 ? b.Start.ToString("d MMM", India) : b.Start.Day.ToString(India);
        return i == 0 || b.Start.Month == 1 ? b.Start.ToString("MMM yy", India) : b.Start.ToString("MMM", India);
    }

    // Page 1: four figures and six charts, nothing else.
    private static void Overview(IContainer container, AnalyticsReportDto r, string unit)
    {
        var s = r.Summary;
        var labels = r.Buckets.Select((b, i) => ChartLabel(b, i, unit)).ToList();
        IReadOnlyList<decimal> Of(Func<AnalyticsBucketDto, decimal> f) => r.Buckets.Select(f).ToList();
        string CountFmt(decimal v) => v.ToString("N0", India);
        const double w = 244, h = 150;

        container.Column(col =>
        {
            col.Spacing(10);

            col.Item().Row(row =>
            {
                row.Spacing(10);
                void Card(string label, string value, string rule, string color) =>
                    row.RelativeItem().Background(Panel).Row(c =>
                    {
                        c.ConstantItem(4).Background(Color.FromHex(color));
                        c.RelativeItem().PaddingVertical(7).PaddingHorizontal(10).Column(k =>
                        {
                            k.Item().Text(label).FontSize(8.5f).SemiBold().FontColor(Muted);
                            k.Item().Text(value).FontSize(19).Bold().FontColor(Ink);
                            k.Item().Text(rule).FontSize(7).FontColor(Muted);
                        });
                    });
                Card("Bookings", Count(s.NewBookings), "booked in this period", Blue);
                Card("Events completed", Count(s.Completed), "event date in this period", Green);
                Card("Money received", Money(s.MoneyReceived), "payments in this period", Green);
                Card("Customers owe", Money(s.Outstanding), "unpaid on this period's events", Orange);
            });

            void Cell(IContainer c, string title, string total, Action<IContainer> body) =>
                c.Border(0.6f).BorderColor(Line).Padding(6).Column(k =>
                {
                    k.Spacing(3);
                    k.Item().Row(t =>
                    {
                        t.RelativeItem().Text(title).FontSize(9.5f).Bold().FontColor(Accent);
                        t.AutoItem().Text(total).FontSize(8.5f).SemiBold().FontColor(Muted);
                    });
                    k.Item().Element(body);
                });

            void Donut(IContainer c, IReadOnlyList<ChartSvg.Slice> slices, int centre) =>
                c.Height((float)h).Row(row =>
                {
                    row.ConstantItem(118).AlignMiddle().Svg(ChartSvg.Donut(118, slices, centre.ToString("N0", India), "events"));
                    row.RelativeItem().PaddingLeft(8).AlignMiddle().Column(lg =>
                    {
                        lg.Spacing(4);
                        foreach (var sl in slices)
                        {
                            lg.Item().Row(x =>
                            {
                                x.AutoItem().PaddingTop(2).Width(7).Height(7).Background(Color.FromHex(sl.Color));
                                x.RelativeItem().PaddingLeft(4).Text(sl.Name).FontSize(8).ClampLines(1);
                                x.AutoItem().Text(sl.Value.ToString("N0", India)).FontSize(8.5f).Bold();
                            });
                        }
                    });
                });

            var statuses = new List<ChartSvg.Slice>
            {
                new("Completed", Green, s.Completed),
                new("Upcoming", Blue, r.Statuses.Where(x => x.Status is "Upcoming" or "Confirmed").Sum(x => x.Count)),
                new("Ongoing (today)", Orange, r.Statuses.Where(x => x.Status == "Ongoing").Sum(x => x.Count)),
                new("Cancelled", Red, s.Cancelled)
            };
            var types = r.EventTypes.Take(6).Select((t, i) => new ChartSvg.Slice(t.Name, TypeColors[i % TypeColors.Length], t.Events)).ToList();
            if (r.EventTypes.Count > 6)
            {
                types.Add(new ChartSvg.Slice("Other", TypeColors[7], r.EventTypes.Skip(6).Sum(t => t.Events)));
            }
            var busiest = r.EventDays.OrderByDescending(d => d.Events).ThenBy(d => d.Date).FirstOrDefault();

            col.Item().Row(row =>
            {
                row.Spacing(10);
                row.RelativeItem().Element(c => Cell(c, "Booking trend", $"{Count(s.NewBookings)} bookings",
                    b => b.Svg(ChartSvg.Line(w, h, labels, Of(x => x.NewBookings), Blue, CountFmt))));
                row.RelativeItem().Element(c => Cell(c, "Event status", $"{Count(s.Events)} events", b => Donut(b, statuses, s.Events)));
                row.RelativeItem().Element(c => Cell(c, "Money received", Money(s.MoneyReceived),
                    b => b.Svg(ChartSvg.Bars(w, h, labels, [new("Received", Green, Of(x => x.MoneyReceived))], Short, Short))));
            });
            col.Item().Row(row =>
            {
                row.Spacing(10);
                row.RelativeItem().Element(c => Cell(c, "Customer outstanding", Money(s.Outstanding),
                    b => b.Svg(ChartSvg.Bars(w, h, labels, [new("Outstanding", Orange, Of(x => x.Outstanding))], Short, Short))));
                row.RelativeItem().Element(c => Cell(c, "Event types", $"{Count(s.Events)} events",
                    b => { if (types.Count == 0) b.Height((float)h).AlignCenter().AlignMiddle().Text("No events").FontColor(Muted); else Donut(b, types, s.Events); }));
                row.RelativeItem().Element(c => Cell(c, "Busy days",
                    busiest is { Events: > 0 } ? $"busiest {busiest.Date.ToString("d MMM", India)} · {Count(busiest.Events)}" : "no events",
                    b => b.Svg(ChartSvg.Heatmap(w, h, r.EventDays.Select(d => (d.Date, d.Events)).ToList()))));
            });
        });
    }

    // The optional detail pages: the figures behind the charts, as tables.
    private static void Details(IContainer container, AnalyticsReportDto r, string unit)
    {
        var s = r.Summary;
        var p = r.Profit;
        container.Column(col =>
        {
            col.Spacing(14);
            col.Item().Text("Details").FontSize(13).Bold().FontColor(Accent);
            col.Item().Text("Bookings count by booking date; events by event date; money by payment date.").FontSize(8).FontColor(Muted);

            col.Item().Element(e => Section(e, $"By {unit}", c => c.Item().Table(t =>
            {
                t.ColumnsDefinition(d =>
                {
                    d.RelativeColumn(1.4f);
                    for (var i = 0; i < 4; i++) d.RelativeColumn(1);
                    for (var i = 0; i < 3; i++) d.RelativeColumn(1.4f);
                });
                Head(t, unit == "day" ? "Date" : "Month", "Bookings", "Events", "Completed", "Cancelled", "Event value", "Received", "Customers owe");
                var zebra = false;
                foreach (var b in r.Buckets)
                {
                    zebra = !zebra;
                    Cells(t, zebra, false, b.Label, Count(b.NewBookings), Count(b.Events), Count(b.Completed), Count(b.Cancelled),
                        Money(b.EventValue), Money(b.MoneyReceived), Money(b.Outstanding));
                }
                Cells(t, false, true, "Total", Count(s.NewBookings), Count(s.Events), Count(s.Completed), Count(s.Cancelled),
                    Money(s.EventValue), Money(s.MoneyReceived), Money(s.Outstanding));
            })));

            col.Item().Element(e => Section(e, "Event types", c =>
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
                    Head(t, "Type", "Events", "Completed", "Cancelled", "Upcoming / today", "Event value", "Received");
                    var zebra = false;
                    foreach (var x in r.EventTypes)
                    {
                        zebra = !zebra;
                        Cells(t, zebra, false, x.Name, Count(x.Events), Count(x.Completed), Count(x.Cancelled), Count(x.Pending), Money(x.EventValue), Money(x.Received));
                    }
                });
            }));

            col.Item().Element(e => Section(e, "Events", c =>
            {
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
                        d.RelativeColumn(2.4f);
                        for (var i = 0; i < 4; i++) d.RelativeColumn(1.3f);
                    });
                    Head(t, "Date", "Customer", "Event total", "Expenses", "Received", "Customer owes");
                    var zebra = false;
                    foreach (var x in p.Events)
                    {
                        zebra = !zebra;
                        Cells(t, zebra, false, Day(x.EventDate), x.CustomerName + (string.IsNullOrWhiteSpace(x.Venue) ? "" : $" · {x.Venue}"),
                            Money(x.EventTotal), Money(x.Expenses), Money(x.CollectedRevenue), Money(x.OutstandingBalance));
                    }
                    Cells(t, false, true, "Total", $"{Count(p.Events.Count)} events", Money(p.EventsTotalAmount), Money(p.EventsExpenses),
                        Money(p.Events.Sum(x => x.CollectedRevenue)), Money(p.EventsOutstandingBalance));
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
                (i == 0 || titles[i] is "Customer" or "Type" or "Category" ? cell : cell.AlignRight())
                    .Text(titles[i]).FontSize(8).Bold().FontColor(Colors.White);
            }
        });
    }

    // First column left-aligned (and the second when it is text), the rest right-aligned.
    private static void Cells(TableDescriptor t, bool zebra, bool total, params string[] values)
    {
        for (var i = 0; i < values.Length; i++)
        {
            var cell = t.Cell().Background(total ? Colors.Grey.Lighten3 : zebra ? Panel : Colors.White)
                .BorderBottom(0.5f).BorderColor(Line).PaddingVertical(3).PaddingHorizontal(5);
            var leftAligned = i == 0 || (i == 1 && !LooksNumeric(values[i]));
            var text = (leftAligned ? cell : cell.AlignRight()).Text(values[i]);
            if (total) text.Bold();
        }
    }

    private static bool LooksNumeric(string value) => value.StartsWith("Rs.") || value.StartsWith("-Rs.") || value.All(ch => char.IsDigit(ch) || ch == ',');
}
