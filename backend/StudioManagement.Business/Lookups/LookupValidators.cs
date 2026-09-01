using FluentValidation;

namespace StudioManagement.Business.Lookups;

public class CreateLookupRequestValidator : AbstractValidator<CreateLookupRequestDto>
{
    public CreateLookupRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
    }
}

public class UpdateLookupRequestValidator : AbstractValidator<UpdateLookupRequestDto>
{
    public UpdateLookupRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
    }
}
