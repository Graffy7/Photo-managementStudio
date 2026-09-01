using FluentValidation;

namespace StudioManagement.Business.Services;

public class CreateServiceRequestValidator : AbstractValidator<CreateServiceRequestDto>
{
    public CreateServiceRequestValidator()
    {
        RuleFor(x => x.ServiceName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.DefaultPrice).GreaterThanOrEqualTo(0);
    }
}

public class UpdateServiceRequestValidator : AbstractValidator<UpdateServiceRequestDto>
{
    public UpdateServiceRequestValidator()
    {
        RuleFor(x => x.ServiceName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.DefaultPrice).GreaterThanOrEqualTo(0);
    }
}
