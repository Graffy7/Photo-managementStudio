using FluentValidation;

namespace StudioManagement.Business.Leads;

public class CreateLeadRequestValidator : AbstractValidator<CreateLeadRequestDto>
{
    public CreateLeadRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MobileNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.ExpectedBudget).GreaterThanOrEqualTo(0).When(x => x.ExpectedBudget.HasValue);
        RuleFor(x => x.Location).MaximumLength(500);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class UpdateLeadRequestValidator : AbstractValidator<UpdateLeadRequestDto>
{
    public UpdateLeadRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MobileNumber).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.ExpectedBudget).GreaterThanOrEqualTo(0).When(x => x.ExpectedBudget.HasValue);
        RuleFor(x => x.Location).MaximumLength(500);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
