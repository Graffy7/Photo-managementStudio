using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.FormConfig;

public class UpdateFormFieldRequestValidator : AbstractValidator<UpdateFormFieldRequestDto>
{
    public UpdateFormFieldRequestValidator()
    {
        RuleFor(x => x.Label).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Placeholder).MaximumLength(200);
        RuleFor(x => x.DisplayOrder).GreaterThanOrEqualTo(0);
    }
}

public class CreateCustomFieldRequestValidator : AbstractValidator<CreateCustomFieldRequestDto>
{
    public CreateCustomFieldRequestValidator()
    {
        RuleFor(x => x.FieldKey).NotEmpty().MaximumLength(100).Matches("^[A-Za-z][A-Za-z0-9_]*$")
            .WithMessage("FieldKey must start with a letter and contain only letters, numbers, and underscores.");
        RuleFor(x => x.Label).NotEmpty().MaximumLength(150);
        RuleFor(x => x.FieldType).NotEmpty().Must(t => FieldTypes.All.Contains(t))
            .WithMessage($"FieldType must be one of: {string.Join(", ", FieldTypes.All)}");
    }
}
