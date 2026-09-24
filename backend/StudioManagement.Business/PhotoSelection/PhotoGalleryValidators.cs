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

public class SaveFolderRequestValidator : AbstractValidator<SaveFolderRequestDto>
{
    public SaveFolderRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        // A folder name ends up beside real folder names on screen; path separators would be
        // confusing at best.
        RuleFor(x => x.Name).Must(n => n is null || !n.Any(c => c is '\\' or '/'))
            .WithMessage(@"A folder name can't contain \ or /.");
    }
}

public class GenerateLinkRequestValidator : AbstractValidator<GenerateLinkRequestDto>
{
    public GenerateLinkRequestValidator()
    {
        RuleFor(x => x.ExpiresInDays).Must(d => LinkPeriods.Allowed.Contains(d))
            .WithMessage("The link can be valid for 5 or 10 days.");
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
