using FluentValidation;

namespace StudioManagement.Business.Settings;

public class BusinessSettingsValidator : AbstractValidator<BusinessSettingsDto>
{
    public BusinessSettingsValidator()
    {
        RuleFor(x => x.QuotationValidityDays).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Currency).NotEmpty().MaximumLength(10);
        RuleFor(x => x.TaxPercentage).InclusiveBetween(0, 100);
        RuleFor(x => x.PaymentTerms).MaximumLength(2000);
        RuleFor(x => x.AdvancePaymentPercentage).InclusiveBetween(0, 100);
        RuleFor(x => x.DateFormat).NotEmpty().MaximumLength(20);
        RuleFor(x => x.TimeFormat).NotEmpty().MaximumLength(10);
    }
}

public class QuotationSettingsValidator : AbstractValidator<QuotationSettingsDto>
{
    public QuotationSettingsValidator()
    {
        RuleFor(x => x.Prefix).NotEmpty().MaximumLength(20);
        RuleFor(x => x.StartingNumber).GreaterThanOrEqualTo(1);
        RuleFor(x => x.DefaultTerms).MaximumLength(4000);
        RuleFor(x => x.DefaultNotes).MaximumLength(4000);
    }
}
