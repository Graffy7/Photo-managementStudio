namespace StudioManagement.Business.Common;

public enum DateRangePreset
{
    Today,
    Yesterday,
    ThisWeek,
    PreviousWeek,
    ThisMonth,
    PreviousMonth,
    ThisYear,
    PreviousYear,
    Custom,
    // Reports: rolling windows ending today. 7 days and 1 month are shown day by day; 3, 6 and 12
    // months are whole calendar months (the current one up to today), shown month by month.
    Last7Days,
    Last1Month,
    Last3Months,
    Last6Months,
    Last1Year
}

public enum DateGrouping
{
    Day,
    Month
}

// Start is inclusive, End is exclusive — every dashboard/report query filters with
// [Start, End) so a range never double-counts the boundary instant.
public class DateRange
{
    public DateTime Start { get; init; }
    public DateTime End { get; init; }

    // The same range as UTC instants, for columns stored as UTC timestamps (CreatedAt) rather than
    // calendar dates (EventDate, PaymentDate...): "today" means today in the studio's time zone.
    public DateTime StartUtc => BusinessClock.ToUtc(Start);
    public DateTime EndUtc => BusinessClock.ToUtc(End);

    // The immediately-preceding window of the same length — used for "vs last period" deltas.
    // For calendar presets (month/year) this is length-equal rather than calendar-equal (e.g. 28
    // vs 31 days), which is the honest tradeoff for a single generic definition that works for
    // every preset, including Custom.
    public DateRange Previous()
    {
        var duration = End - Start;
        return new DateRange { Start = Start - duration, End = Start };
    }

    public static DateRange Resolve(DateRangePreset preset, DateTime? customStart = null, DateTime? customEnd = null)
    {
        // The studio's calendar day (India), not UTC's - UTC is still "yesterday" until 05:30 IST.
        var today = BusinessClock.Today;

        return preset switch
        {
            DateRangePreset.Today => new DateRange { Start = today, End = today.AddDays(1) },
            DateRangePreset.Yesterday => new DateRange { Start = today.AddDays(-1), End = today },
            DateRangePreset.ThisWeek => WeekRange(today, 0),
            DateRangePreset.PreviousWeek => WeekRange(today, -1),
            DateRangePreset.ThisMonth => MonthRange(today, 0),
            DateRangePreset.PreviousMonth => MonthRange(today, -1),
            DateRangePreset.ThisYear => YearRange(today, 0),
            DateRangePreset.PreviousYear => YearRange(today, -1),
            DateRangePreset.Last7Days => new DateRange { Start = today.AddDays(-6), End = today.AddDays(1) },
            DateRangePreset.Last1Month => new DateRange { Start = today.AddMonths(-1).AddDays(1), End = today.AddDays(1) },
            DateRangePreset.Last3Months => MonthsToDate(today, 3),
            DateRangePreset.Last6Months => MonthsToDate(today, 6),
            DateRangePreset.Last1Year => MonthsToDate(today, 12),
            DateRangePreset.Custom => new DateRange
            {
                Start = (customStart ?? today).Date,
                End = (customEnd ?? today).Date.AddDays(1)
            },
            _ => new DateRange { Start = today, End = today.AddDays(1) }
        };
    }

    // How a report over this range is grouped: by day for short ranges, by month for long ones.
    public static DateGrouping GroupingFor(DateRangePreset preset, DateRange range) => preset switch
    {
        DateRangePreset.Last7Days or DateRangePreset.Last1Month => DateGrouping.Day,
        DateRangePreset.Last3Months or DateRangePreset.Last6Months or DateRangePreset.Last1Year => DateGrouping.Month,
        _ => (range.End - range.Start).TotalDays <= 62 ? DateGrouping.Day : DateGrouping.Month
    };

    // The last `months` calendar months, the current one only up to today.
    private static DateRange MonthsToDate(DateTime today, int months)
    {
        var firstOfThisMonth = new DateTime(today.Year, today.Month, 1);
        return new DateRange { Start = firstOfThisMonth.AddMonths(-(months - 1)), End = today.AddDays(1) };
    }

    private static DateRange WeekRange(DateTime today, int weekOffset)
    {
        var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
        var startOfThisWeek = today.AddDays(-daysSinceMonday);
        var start = startOfThisWeek.AddDays(7 * weekOffset);
        return new DateRange { Start = start, End = start.AddDays(7) };
    }

    private static DateRange MonthRange(DateTime today, int monthOffset)
    {
        var firstOfThisMonth = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var start = firstOfThisMonth.AddMonths(monthOffset);
        return new DateRange { Start = start, End = start.AddMonths(1) };
    }

    private static DateRange YearRange(DateTime today, int yearOffset)
    {
        var start = new DateTime(today.Year + yearOffset, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        return new DateRange { Start = start, End = start.AddYears(1) };
    }
}
