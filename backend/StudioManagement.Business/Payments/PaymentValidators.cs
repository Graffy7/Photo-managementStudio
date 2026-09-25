using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Payments;

public class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequestDto>
{
    public CreatePaymentRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        // Positive = a payment received; negative = a deduction/refund (reason required, capped at
        // what's been paid - checked by PaymentService against the stored figures). Zero means nothing.
        RuleFor(x => x.Amount).NotEqual(0).WithMessage("Enter an amount more than zero.");
        RuleFor(x => x.PaymentDate).NotEqual(default(DateTime));
        RuleFor(x => x.PaymentMethod).NotEmpty().Must(s => PaymentMethods.All.Contains(s))
            .WithMessage($"PaymentMethod must be one of: {string.Join(", ", PaymentMethods.All)}");
        RuleFor(x => x.PaymentStatus).NotEmpty().Must(s => PaymentStatuses.All.Contains(s))
            .WithMessage($"PaymentStatus must be one of: {string.Join(", ", PaymentStatuses.All)}");
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}

public class UpdatePaymentRequestValidator : AbstractValidator<UpdatePaymentRequestDto>
{
    public UpdatePaymentRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        // Positive = a payment received; negative = a deduction/refund (reason required, capped at
        // what's been paid - checked by PaymentService against the stored figures). Zero means nothing.
        RuleFor(x => x.Amount).NotEqual(0).WithMessage("Enter an amount more than zero.");
        RuleFor(x => x.PaymentDate).NotEqual(default(DateTime));
        RuleFor(x => x.PaymentMethod).NotEmpty().Must(s => PaymentMethods.All.Contains(s))
            .WithMessage($"PaymentMethod must be one of: {string.Join(", ", PaymentMethods.All)}");
        RuleFor(x => x.PaymentStatus).NotEmpty().Must(s => PaymentStatuses.All.Contains(s))
            .WithMessage($"PaymentStatus must be one of: {string.Join(", ", PaymentStatuses.All)}");
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}
