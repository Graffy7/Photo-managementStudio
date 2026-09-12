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
    Custom
}

// Start is inclusive, End is exclusive — every dashboard/report query filters with
// [Start, End) so a range never double-counts the boundary instant.
public class DateRange
{
    public DateTime Start { get; init; }
    public DateTime End { get; init; }

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
        var today = DateTime.UtcNow.Date;

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
            DateRangePreset.Custom => new DateRange
            {
                Start = (customStart ?? today).Date,
                End = (customEnd ?? today).Date.AddDays(1)
            },
            _ => new DateRange { Start = today, End = today.AddDays(1) }
        };
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
