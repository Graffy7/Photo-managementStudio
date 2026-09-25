using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Quotations;

public class QuotationItemRequestValidator : AbstractValidator<QuotationItemRequestDto>
{
    public QuotationItemRequestValidator()
    {
        RuleFor(x => x).Must(i => (i.ServiceId ?? 0) > 0 || !string.IsNullOrWhiteSpace(i.CustomName))
            .WithName("Items").WithMessage("Each line needs a service or a name.");
        RuleFor(x => x.CustomName).MaximumLength(200);
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public class CreateQuotationRequestValidator : AbstractValidator<CreateQuotationRequestDto>
{
    public CreateQuotationRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        RuleFor(x => x.QuotationDate).NotEqual(default(DateTime));
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
        // A discount larger than the line items would hand the customer a negative total, which is
        // not a quotation anyone can send - stop it here rather than storing a nonsense figure.
        RuleFor(x => x.Discount)
            .LessThanOrEqualTo(x => x.Items.Sum(i => i.Quantity * i.UnitPrice))
            .When(x => x.Items is { Count: > 0 })
            .WithMessage("Discount can't be more than the total of the line items.");
        RuleFor(x => x.TaxAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Status).NotEmpty().Must(s => QuotationStatuses.All.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", QuotationStatuses.All)}");
        RuleFor(x => x.TermsAndConditions).MaximumLength(4000);
        RuleFor(x => x.PriceDisplay).Must(v => v is null || QuotationPriceDisplays.All.Contains(v))
            .WithMessage("Price display must be Detailed or TotalOnly.");
        RuleFor(x => x.ManualTotal).GreaterThan(0).LessThanOrEqualTo(1_000_000_000).When(x => x.ManualTotal is not null)
            .WithMessage("Enter a total amount above zero.");
        RuleFor(x => x.Items).NotEmpty().WithMessage("Add at least one line item.");
        RuleForEach(x => x.Items).SetValidator(new QuotationItemRequestValidator());
    }
}

public class UpdateQuotationRequestValidator : AbstractValidator<UpdateQuotationRequestDto>
{
    public UpdateQuotationRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        RuleFor(x => x.QuotationDate).NotEqual(default(DateTime));
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
        // A discount larger than the line items would hand the customer a negative total, which is
        // not a quotation anyone can send - stop it here rather than storing a nonsense figure.
        RuleFor(x => x.Discount)
            .LessThanOrEqualTo(x => x.Items.Sum(i => i.Quantity * i.UnitPrice))
            .When(x => x.Items is { Count: > 0 })
            .WithMessage("Discount can't be more than the total of the line items.");
        RuleFor(x => x.TaxAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Status).NotEmpty().Must(s => QuotationStatuses.All.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", QuotationStatuses.All)}");
        RuleFor(x => x.TermsAndConditions).MaximumLength(4000);
        RuleFor(x => x.PriceDisplay).Must(v => v is null || QuotationPriceDisplays.All.Contains(v))
            .WithMessage("Price display must be Detailed or TotalOnly.");
        RuleFor(x => x.ManualTotal).GreaterThan(0).LessThanOrEqualTo(1_000_000_000).When(x => x.ManualTotal is not null)
            .WithMessage("Enter a total amount above zero.");
        RuleFor(x => x.Items).NotEmpty().WithMessage("Add at least one line item.");
        RuleForEach(x => x.Items).SetValidator(new QuotationItemRequestValidator());
    }
}

public class SetQuotationStatusRequestValidator : AbstractValidator<SetQuotationStatusRequestDto>
{
    public SetQuotationStatusRequestValidator()
    {
        RuleFor(x => x.Status).NotEmpty().Must(s => QuotationStatuses.All.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", QuotationStatuses.All)}");
    }
}
