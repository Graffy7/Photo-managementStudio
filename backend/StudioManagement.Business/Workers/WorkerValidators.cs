using FluentValidation;
using StudioManagement.Business.Common;

namespace StudioManagement.Business.Workers;

public class CreateWorkerRequestValidator : AbstractValidator<CreateWorkerRequestDto>
{
    public CreateWorkerRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MobileNumber).MaximumLength(20)
            .MustBeAMobileNumber().When(x => !string.IsNullOrWhiteSpace(x.MobileNumber));
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class UpdateWorkerRequestValidator : AbstractValidator<UpdateWorkerRequestDto>
{
    public UpdateWorkerRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.MobileNumber).MaximumLength(20)
            .MustBeAMobileNumber().When(x => !string.IsNullOrWhiteSpace(x.MobileNumber));
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
