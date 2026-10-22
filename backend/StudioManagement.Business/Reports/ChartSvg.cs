using System.Globalization;
using System.Net;
using System.Text;

namespace StudioManagement.Business.Reports;

// Small chart drawings (SVG) for the report PDF: bars, a line and a donut. Every value is drawn from
// the figures passed in; values are printed on the chart where there is room, and the axis always
// shows the scale.
public static class ChartSvg
{
    private const string Font = "font-family=\"Lato, Arial, sans-serif\"";
    private const string Grid = "#E3E8EF";
    private const string Axis = "#6B7785";
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    public record Series(string Name, string Color, IReadOnlyList<decimal> Values);
    public record Slice(string Name, string Color, decimal Value);

    private static string N(double v) => v.ToString("0.##", Inv);
    private static string Esc(string s) => WebUtility.HtmlEncode(s);

    // A tidy scale: a round step (1, 2, 2.5 or 5 times a power of ten - whole numbers for counts)
    // and as many steps (1-5) as reach the largest value.
    private static (double Top, int Steps) Scale(double max, bool whole)
    {
        if (max <= 0) return (1, 1);
        var raw = max / 4;
        var p = Math.Pow(10, Math.Floor(Math.Log10(raw)));
        var step = 10 * p;
        foreach (var f in new[] { 1, 2, 2.5, 5, 10 })
        {
            var candidate = f * p;
            if (candidate < raw) continue;
            if (whole && (candidate < 1 || candidate % 1 != 0)) continue;
            step = candidate;
            break;
        }
        if (whole) step = Math.Max(1, Math.Ceiling(step));
        var steps = Math.Max(1, (int)Math.Ceiling(max / step - 1e-9));
        return (step * steps, steps);
    }

    // Labels under the chart, thinned so they never overlap.
    private static void XLabels(StringBuilder sb, IReadOnlyList<string> labels, double left, double slot, double y)
    {
        var fit = Math.Max(2, (int)(slot * labels.Count / 34));
        var every = Math.Max(1, (int)Math.Ceiling(labels.Count / (double)Math.Min(12, fit)));
        for (var i = 0; i < labels.Count; i += every)
        {
            var x = left + slot * i + slot / 2;
            sb.Append($"<text x=\"{N(x)}\" y=\"{N(y)}\" font-size=\"8\" fill=\"{Axis}\" text-anchor=\"middle\" {Font}>{Esc(labels[i])}</text>");
        }
    }

    private static void YAxis(StringBuilder sb, double top, double left, double right, double plotH, (double Top, int Steps) scale, Func<decimal, string> fmt)
    {
        for (var g = 0; g <= scale.Steps; g++)
        {
            var y = top + plotH - plotH * g / scale.Steps;
            sb.Append($"<line x1=\"{N(left)}\" y1=\"{N(y)}\" x2=\"{N(right)}\" y2=\"{N(y)}\" stroke=\"{Grid}\" stroke-width=\"0.6\"/>");
            sb.Append($"<text x=\"{N(left - 4)}\" y=\"{N(y + 3)}\" font-size=\"7.5\" fill=\"{Axis}\" text-anchor=\"end\" {Font}>{Esc(fmt((decimal)(scale.Top * g / scale.Steps)))}</text>");
        }
    }

    // stacked: one bar per period with the series on top of each other (the total printed on top);
    // otherwise the series stand side by side. whole: counts, so the scale uses whole numbers.
    public static string Bars(double width, double height, IReadOnlyList<string> labels, IReadOnlyList<Series> series, Func<decimal, string> fmt, Func<decimal, string> axisFmt,
        bool whole = false, bool stacked = false)
    {
        const double top = 14, bottom = 18;
        var left = 44.0;
        var right = width - 6;
        var plotH = height - top - bottom;
        var n = Math.Max(1, labels.Count);
        var slot = (right - left) / n;
        decimal At(Series se, int i) => i < se.Values.Count ? se.Values[i] : 0;
        var max = stacked
            ? Enumerable.Range(0, n).Select(i => series.Sum(se => At(se, i))).DefaultIfEmpty(0).Max()
            : series.SelectMany(se => se.Values).DefaultIfEmpty(0).Max();
        var scale = Scale((double)max, whole);
        var niceMax = scale.Top;

        var sb = new StringBuilder($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{N(width)}\" height=\"{N(height)}\" viewBox=\"0 0 {N(width)} {N(height)}\">");
        YAxis(sb, top, left, right, plotH, scale, axisFmt);

        var groupW = slot * 0.72;
        var barW = stacked ? groupW : groupW / series.Count;
        // Exact values on top of the bars when they fit.
        var showValues = (stacked ? n : n * series.Count) <= 24;
        if (stacked)
        {
            for (var i = 0; i < n; i++)
            {
                var x = left + slot * i + (slot - groupW) / 2;
                var y = top + plotH;
                var total = 0m;
                foreach (var se in series)
                {
                    var v = At(se, i);
                    if (v <= 0) continue;
                    total += v;
                    var segment = plotH * (double)v / niceMax;
                    y -= segment;
                    sb.Append($"<rect x=\"{N(x)}\" y=\"{N(y)}\" width=\"{N(Math.Max(0.8, barW))}\" height=\"{N(segment)}\" fill=\"{se.Color}\"/>");
                }
                if (showValues && total > 0)
                {
                    sb.Append($"<text x=\"{N(x + barW / 2)}\" y=\"{N(y - 2.5)}\" font-size=\"7\" fill=\"#333D48\" text-anchor=\"middle\" {Font}>{Esc(fmt(total))}</text>");
                }
            }
            sb.Append($"<line x1=\"{N(left)}\" y1=\"{N(top + plotH)}\" x2=\"{N(right)}\" y2=\"{N(top + plotH)}\" stroke=\"#B8C2CE\" stroke-width=\"0.8\"/>");
            XLabels(sb, labels, left, slot, height - 5);
            sb.Append("</svg>");
            return sb.ToString();
        }
        for (var i = 0; i < n; i++)
        {
            for (var s = 0; s < series.Count; s++)
            {
                var v = i < series[s].Values.Count ? series[s].Values[i] : 0;
                var h = niceMax > 0 ? plotH * (double)v / niceMax : 0;
                if (v > 0 && h < 1.5) h = 1.5;
                var x = left + slot * i + (slot - groupW) / 2 + barW * s;
                var y = top + plotH - h;
                if (v > 0)
                {
                    sb.Append($"<rect x=\"{N(x)}\" y=\"{N(y)}\" width=\"{N(Math.Max(0.8, barW - 0.8))}\" height=\"{N(h)}\" rx=\"1\" fill=\"{series[s].Color}\"/>");
                    if (showValues)
                    {
                        sb.Append($"<text x=\"{N(x + barW / 2)}\" y=\"{N(y - 2.5)}\" font-size=\"7\" fill=\"#333D48\" text-anchor=\"middle\" {Font}>{Esc(fmt(v))}</text>");
                    }
                }
            }
        }
        sb.Append($"<line x1=\"{N(left)}\" y1=\"{N(top + plotH)}\" x2=\"{N(right)}\" y2=\"{N(top + plotH)}\" stroke=\"#B8C2CE\" stroke-width=\"0.8\"/>");
        XLabels(sb, labels, left, slot, height - 5);
        sb.Append("</svg>");
        return sb.ToString();
    }

    public static string Line(double width, double height, IReadOnlyList<string> labels, IReadOnlyList<decimal> values, string color, Func<decimal, string> fmt)
    {
        const double top = 14, bottom = 18;
        var left = 44.0;
        var right = width - 6;
        var plotH = height - top - bottom;
        var n = Math.Max(1, labels.Count);
        var slot = (right - left) / n;
        var scale = Scale((double)values.DefaultIfEmpty(0).Max(), whole: true);
        var niceMax = scale.Top;

        var sb = new StringBuilder($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{N(width)}\" height=\"{N(height)}\" viewBox=\"0 0 {N(width)} {N(height)}\">");
        YAxis(sb, top, left, right, plotH, scale, fmt);

        var pts = values.Select((v, i) => (X: left + slot * i + slot / 2, Y: top + plotH - plotH * (double)v / niceMax, V: v)).ToList();
        if (pts.Count > 0)
        {
            var line = string.Join(" ", pts.Select(p => $"{N(p.X)},{N(p.Y)}"));
            var area = $"{N(pts[0].X)},{N(top + plotH)} {line} {N(pts[^1].X)},{N(top + plotH)}";
            sb.Append($"<polygon points=\"{area}\" fill=\"{color}\" fill-opacity=\"0.12\"/>");
            sb.Append($"<polyline points=\"{line}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"1.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>");
            var showValues = pts.Count <= 31;
            foreach (var p in pts)
            {
                sb.Append($"<circle cx=\"{N(p.X)}\" cy=\"{N(p.Y)}\" r=\"{(pts.Count > 20 ? 1.6 : 2.4)}\" fill=\"#FFFFFF\" stroke=\"{color}\" stroke-width=\"1.2\"/>");
                if (showValues && p.V > 0)
                {
                    sb.Append($"<text x=\"{N(p.X)}\" y=\"{N(p.Y - 5)}\" font-size=\"7\" fill=\"#333D48\" text-anchor=\"middle\" {Font}>{Esc(fmt(p.V))}</text>");
                }
            }
        }
        sb.Append($"<line x1=\"{N(left)}\" y1=\"{N(top + plotH)}\" x2=\"{N(right)}\" y2=\"{N(top + plotH)}\" stroke=\"#B8C2CE\" stroke-width=\"0.8\"/>");
        XLabels(sb, labels, left, slot, height - 5);
        sb.Append("</svg>");
        return sb.ToString();
    }

    // A ring split by value, with the total in the middle. The legend is drawn next to it by the PDF.
    public static string Donut(double size, IReadOnlyList<Slice> slices, string centerValue, string centerLabel)
    {
        var c = size / 2;
        var r = size / 2 - 10;
        const double stroke = 16;
        var total = slices.Sum(s => s.Value);
        var sb = new StringBuilder($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{N(size)}\" height=\"{N(size)}\" viewBox=\"0 0 {N(size)} {N(size)}\">");
        sb.Append($"<circle cx=\"{N(c)}\" cy=\"{N(c)}\" r=\"{N(r)}\" fill=\"none\" stroke=\"#EEF1F5\" stroke-width=\"{N(stroke)}\"/>");
        if (total > 0)
        {
            var start = -Math.PI / 2;
            foreach (var s in slices.Where(s => s.Value > 0))
            {
                var sweep = 2 * Math.PI * (double)(s.Value / total);
                if (sweep >= 2 * Math.PI - 1e-6)
                {
                    sb.Append($"<circle cx=\"{N(c)}\" cy=\"{N(c)}\" r=\"{N(r)}\" fill=\"none\" stroke=\"{s.Color}\" stroke-width=\"{N(stroke)}\"/>");
                    break;
                }
                var end = start + sweep;
                var (x1, y1) = (c + r * Math.Cos(start), c + r * Math.Sin(start));
                var (x2, y2) = (c + r * Math.Cos(end), c + r * Math.Sin(end));
                var large = sweep > Math.PI ? 1 : 0;
                sb.Append($"<path d=\"M {N(x1)} {N(y1)} A {N(r)} {N(r)} 0 {large} 1 {N(x2)} {N(y2)}\" fill=\"none\" stroke=\"{s.Color}\" stroke-width=\"{N(stroke)}\"/>");
                start = end;
            }
        }
        sb.Append($"<text x=\"{N(c)}\" y=\"{N(c + 3)}\" font-size=\"18\" font-weight=\"bold\" fill=\"#1F2A36\" text-anchor=\"middle\" {Font}>{Esc(centerValue)}</text>");
        sb.Append($"<text x=\"{N(c)}\" y=\"{N(c + 16)}\" font-size=\"8\" fill=\"{Axis}\" text-anchor=\"middle\" {Font}>{Esc(centerLabel)}</text>");
        sb.Append("</svg>");
        return sb.ToString();
    }

    // Busy days: one square per day, darker blue the more events it has. Up to ~6 weeks it is laid out
    // like a calendar (weeks as rows, with the date or count in each square); longer ranges show one
    // row per month with a square for each day of the month.
    public static string Heatmap(double width, double height, IReadOnlyList<(DateTime Date, int Count)> days)
    {
        var sb = new StringBuilder($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{N(width)}\" height=\"{N(height)}\" viewBox=\"0 0 {N(width)} {N(height)}\">");
        if (days.Count == 0) return sb.Append("</svg>").ToString();
        var max = Math.Max(1, days.Max(d => d.Count));
        string Fill(int c)
        {
            if (c <= 0) return "#EEF2F7";
            var t = max == 1 ? 1 : (double)(c - 1) / (max - 1);
            // light blue -> deep blue
            int Mix(int a, int b) => (int)Math.Round(a + (b - a) * t);
            return $"#{Mix(0xB9, 0x12):X2}{Mix(0xD6, 0x4E):X2}{Mix(0xF7, 0xB8):X2}";
        }
        int Dow(DateTime d) => ((int)d.DayOfWeek + 6) % 7; // Monday = 0
        var first = days[0].Date.AddDays(-Dow(days[0].Date));
        var weeks = (int)Math.Ceiling(((days[^1].Date - first).TotalDays + 1) / 7);
        string[] names = ["M", "T", "W", "T", "F", "S", "S"];
        const double legendH = 14;

        if (days.Count <= 45)
        {
            const double headH = 11;
            var cell = Math.Min((width - 2) / 7, (height - headH - legendH) / weeks);
            var x0 = (width - cell * 7) / 2;
            for (var c = 0; c < 7; c++)
                sb.Append($"<text x=\"{N(x0 + cell * c + cell / 2)}\" y=\"8\" font-size=\"7\" fill=\"{Axis}\" text-anchor=\"middle\" {Font}>{names[c]}</text>");
            foreach (var (date, count) in days)
            {
                var w = (int)((date - first).TotalDays / 7);
                var x = x0 + cell * Dow(date);
                var y = headH + cell * w;
                sb.Append($"<rect x=\"{N(x + 1)}\" y=\"{N(y + 1)}\" width=\"{N(cell - 2)}\" height=\"{N(cell - 2)}\" rx=\"2\" fill=\"{Fill(count)}\"/>");
                var light = count > 0 && (double)count / max > 0.5;
                sb.Append($"<text x=\"{N(x + cell / 2)}\" y=\"{N(y + cell / 2 + 2.5)}\" font-size=\"{N(Math.Min(8, cell * 0.38))}\" fill=\"{(light ? "#FFFFFF" : "#4A5562")}\" text-anchor=\"middle\" {Font}>{(count > 0 ? count.ToString(Inv) : date.Day.ToString(Inv))}</text>");
            }
        }
        else
        {
            const double leftW = 26, headH = 10;
            var months = days.Select(d => new DateTime(d.Date.Year, d.Date.Month, 1)).Distinct().ToList();
            var cell = Math.Min((width - leftW) / 31, (height - headH - legendH) / months.Count);
            foreach (var d in new[] { 1, 10, 20, 31 })
                sb.Append($"<text x=\"{N(leftW + cell * (d - 1) + cell / 2)}\" y=\"7\" font-size=\"6.5\" fill=\"{Axis}\" text-anchor=\"middle\" {Font}>{d}</text>");
            for (var m = 0; m < months.Count; m++)
            {
                sb.Append($"<text x=\"0\" y=\"{N(headH + cell * m + cell * 0.72)}\" font-size=\"6.5\" fill=\"{Axis}\" {Font}>{months[m].ToString("MMM yy", Inv)}</text>");
            }
            foreach (var (date, count) in days)
            {
                var m = months.IndexOf(new DateTime(date.Year, date.Month, 1));
                sb.Append($"<rect x=\"{N(leftW + cell * (date.Day - 1) + 0.5)}\" y=\"{N(headH + cell * m + 0.5)}\" width=\"{N(cell - 1)}\" height=\"{N(cell - 1)}\" rx=\"1\" fill=\"{Fill(count)}\"/>");
            }
        }

        // Legend: quiet -> busy, with the busiest count.
        var ly = height - 4;
        sb.Append($"<text x=\"{N(width - 92)}\" y=\"{N(ly)}\" font-size=\"7\" fill=\"{Axis}\" text-anchor=\"end\" {Font}>Quiet</text>");
        for (var k = 0; k < 5; k++)
        {
            var c = k == 0 ? 0 : (int)Math.Ceiling(max * k / 4.0);
            sb.Append($"<rect x=\"{N(width - 88 + k * 11)}\" y=\"{N(ly - 7)}\" width=\"9\" height=\"9\" rx=\"1.5\" fill=\"{Fill(c)}\"/>");
        }
        sb.Append($"<text x=\"{N(width - 30)}\" y=\"{N(ly)}\" font-size=\"7\" fill=\"{Axis}\" {Font}>Busy ({max})</text>");
        return sb.Append("</svg>").ToString();
    }
}
