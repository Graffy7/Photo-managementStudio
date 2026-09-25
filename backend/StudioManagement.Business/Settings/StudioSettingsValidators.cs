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

public class PdfSettingsValidator : AbstractValidator<PdfSettingsDto>
{
    private static readonly string[] Templates = ["Classic", "Modern", "Minimal", "Elegant"];
    private static readonly string[] Headers = ["Standard", "Banner", "Centered"];
    private static readonly string[] LogoPlacements = ["Watermark", "Header", "Both", "None"];

    public PdfSettingsValidator()
    {
        RuleFor(x => x.Template).Must(v => Templates.Contains(v)).WithMessage("Choose one of the templates.");
        RuleFor(x => x.HeaderStyle).Must(v => Headers.Contains(v)).WithMessage("Choose a header style.");
        RuleFor(x => x.LogoPlacement).Must(v => LogoPlacements.Contains(v)).WithMessage("Choose where the logo goes.");
        RuleFor(x => x.PrimaryColor).Matches("^(#[0-9a-fA-F]{6})?$").WithMessage("Use a colour like #1976D2.");
        RuleFor(x => x.AccentColor).Matches("^(#[0-9a-fA-F]{6})?$").WithMessage("Use a colour like #1976D2.");
        RuleFor(x => x.DisplayName).MaximumLength(150);
        RuleFor(x => x.Tagline).MaximumLength(200);
        RuleFor(x => x.FooterText).MaximumLength(500);
        RuleFor(x => x.SignatoryName).MaximumLength(100);
        RuleFor(x => x.SignatoryTitle).MaximumLength(100);
        RuleFor(x => x.BankName).MaximumLength(100);
        RuleFor(x => x.AccountName).MaximumLength(100);
        RuleFor(x => x.AccountNumber).MaximumLength(40);
        RuleFor(x => x.Ifsc).MaximumLength(20);
        RuleFor(x => x.UpiId).MaximumLength(100);
        RuleFor(x => x.PaymentNote).MaximumLength(300);
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
