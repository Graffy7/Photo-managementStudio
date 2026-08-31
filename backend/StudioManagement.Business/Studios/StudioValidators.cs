using FluentValidation;

namespace StudioManagement.Business.Studios;

public class CreateStudioRequestValidator : AbstractValidator<CreateStudioRequestDto>
{
    public CreateStudioRequestValidator()
    {
        RuleFor(x => x.StudioName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OwnerFullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OwnerEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.OwnerPassword).NotEmpty().MinimumLength(8);
        RuleFor(x => x.PhoneNumber).MaximumLength(30);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.SubscriptionPlanId).GreaterThan(0);
    }
}

public class UpdateStudioRequestValidator : AbstractValidator<UpdateStudioRequestDto>
{
    public UpdateStudioRequestValidator()
    {
        RuleFor(x => x.StudioName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.PhoneNumber).MaximumLength(30);
        RuleFor(x => x.Address).MaximumLength(500);
    }
}
