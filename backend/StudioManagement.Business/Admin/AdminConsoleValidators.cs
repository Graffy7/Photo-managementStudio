using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Admin;

public class TrialDaysRequestValidator : AbstractValidator<TrialDaysRequestDto>
{
    public TrialDaysRequestValidator()
    {
        RuleFor(x => x.Days).InclusiveBetween(1, 3650).WithMessage("Enter between 1 and 3650 days.");
    }
}

public class ManualPaymentRequestValidator : AbstractValidator<ManualPaymentRequestDto>
{
    public ManualPaymentRequestValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0).LessThanOrEqualTo(10_000_000).WithMessage("Enter the amount paid.");
        RuleFor(x => x.Months).InclusiveBetween(0, 120).WithMessage("Months must be between 0 and 120.");
        RuleFor(x => x.PaymentMethod).NotEmpty().Must(m => PaymentMethods.All.Contains(m))
            .WithMessage("Choose a payment method.");
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500);
        RuleFor(x => x.PaymentDate).LessThanOrEqualTo(_ => DateTime.UtcNow.AddDays(1))
            .When(x => x.PaymentDate is not null).WithMessage("The payment date can't be in the future.");
    }
}
