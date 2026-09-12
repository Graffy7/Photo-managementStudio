using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Quotations;

public class QuotationItemRequestValidator : AbstractValidator<QuotationItemRequestDto>
{
    public QuotationItemRequestValidator()
    {
        RuleFor(x => x.ServiceId).GreaterThan(0);
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
        RuleFor(x => x.TaxAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Status).NotEmpty().Must(s => QuotationStatuses.All.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", QuotationStatuses.All)}");
        RuleFor(x => x.TermsAndConditions).MaximumLength(4000);
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
        RuleFor(x => x.TaxAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Status).NotEmpty().Must(s => QuotationStatuses.All.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", QuotationStatuses.All)}");
        RuleFor(x => x.TermsAndConditions).MaximumLength(4000);
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
