using FluentValidation;

namespace StudioManagement.Business.PhotoSelection;

public class CreatePhotoSelectionProjectRequestValidator : AbstractValidator<CreatePhotoSelectionProjectRequestDto>
{
    public CreatePhotoSelectionProjectRequestValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SourceFolder).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.DestinationRootFolder).MaximumLength(1000);
        RuleFor(x => x.SelectionLimitTotal).GreaterThan(0).When(x => x.SelectionLimitTotal is not null);
        RuleFor(x => x.SelectionLimitNormal).GreaterThan(0).When(x => x.SelectionLimitNormal is not null);
        RuleFor(x => x.SelectionLimitBig).GreaterThan(0).When(x => x.SelectionLimitBig is not null);
    }
}

public class GenerateLinkRequestValidator : AbstractValidator<GenerateLinkRequestDto>
{
    public GenerateLinkRequestValidator()
    {
        RuleFor(x => x.ExpiresInDays).GreaterThan(0).When(x => x.ExpiresInDays is not null);
        RuleFor(x => x.Pin).MaximumLength(20).When(x => !string.IsNullOrWhiteSpace(x.Pin));
    }
}

public class SetSelectionRequestValidator : AbstractValidator<SetSelectionRequestDto>
{
    public SetSelectionRequestValidator()
    {
        RuleFor(x => x.SelectionType).NotEmpty().Must(v => Data.Common.PhotoSelectionTypes.All.Contains(v))
            .WithMessage("SelectionType must be one of: None, Normal, Big.");
    }
}

public class UnlockRequestValidator : AbstractValidator<UnlockRequestDto>
{
    public UnlockRequestValidator()
    {
        RuleFor(x => x.Pin).NotEmpty().MaximumLength(20);
    }
}
