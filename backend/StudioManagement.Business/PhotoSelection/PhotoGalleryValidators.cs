using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.PhotoSelection;

public class ImportRequestValidator : AbstractValidator<ImportRequestDto>
{
    public ImportRequestValidator()
    {
        RuleFor(x => x.SourceFolder).NotEmpty().MaximumLength(500);
    }
}

public class GenerateLinkRequestValidator : AbstractValidator<GenerateLinkRequestDto>
{
    public GenerateLinkRequestValidator()
    {
        RuleFor(x => x.ExpiresInDays).InclusiveBetween(1, 365)
            .WithMessage("The link must stay valid for between 1 and 365 days.");
    }
}

public class SetSelectionRequestValidator : AbstractValidator<SetSelectionRequestDto>
{
    public SetSelectionRequestValidator()
    {
        RuleFor(x => x.SelectionType).Must(SelectionTypes.IsValid)
            .WithMessage("SelectionType must be 1 (Normal) or 2 (Big).");
    }
}
