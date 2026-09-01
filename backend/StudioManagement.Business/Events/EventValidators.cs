using System.Text.RegularExpressions;
using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Events;

public static class TimeOfDayRule
{
    public static readonly Regex Pattern = new(@"^([01]\d|2[0-3]):[0-5]\d$", RegexOptions.Compiled);
}

public class CreateEventRequestValidator : AbstractValidator<CreateEventRequestDto>
{
    public CreateEventRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        RuleFor(x => x.EventDate).NotEqual(default(DateTime));
        RuleFor(x => x.EventStatus).NotEmpty().Must(s => EventStatuses.All.Contains(s))
            .WithMessage($"EventStatus must be one of: {string.Join(", ", EventStatuses.All)}");
        RuleFor(x => x.StartTime).Matches(TimeOfDayRule.Pattern).When(x => !string.IsNullOrWhiteSpace(x.StartTime));
        RuleFor(x => x.EndTime).Matches(TimeOfDayRule.Pattern).When(x => !string.IsNullOrWhiteSpace(x.EndTime));
        RuleFor(x => x.Budget).GreaterThanOrEqualTo(0).When(x => x.Budget.HasValue);
        RuleFor(x => x.Venue).MaximumLength(200);
        RuleFor(x => x.VenueAddress).MaximumLength(500);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class UpdateEventRequestValidator : AbstractValidator<UpdateEventRequestDto>
{
    public UpdateEventRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        RuleFor(x => x.EventDate).NotEqual(default(DateTime));
        RuleFor(x => x.EventStatus).NotEmpty().Must(s => EventStatuses.All.Contains(s))
            .WithMessage($"EventStatus must be one of: {string.Join(", ", EventStatuses.All)}");
        RuleFor(x => x.StartTime).Matches(TimeOfDayRule.Pattern).When(x => !string.IsNullOrWhiteSpace(x.StartTime));
        RuleFor(x => x.EndTime).Matches(TimeOfDayRule.Pattern).When(x => !string.IsNullOrWhiteSpace(x.EndTime));
        RuleFor(x => x.Budget).GreaterThanOrEqualTo(0).When(x => x.Budget.HasValue);
        RuleFor(x => x.Venue).MaximumLength(200);
        RuleFor(x => x.VenueAddress).MaximumLength(500);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
