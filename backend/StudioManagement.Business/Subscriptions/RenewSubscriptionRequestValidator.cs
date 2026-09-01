using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Subscriptions;

public class RenewSubscriptionRequestValidator : AbstractValidator<RenewSubscriptionRequestDto>
{
    public RenewSubscriptionRequestValidator()
    {
        RuleFor(x => x.PaymentMethod).NotEmpty().Must(m => PaymentMethods.All.Contains(m))
            .WithMessage($"PaymentMethod must be one of: {string.Join(", ", PaymentMethods.All)}");
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}
