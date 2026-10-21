using StudioManagement.Business.Common;
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
        RuleFor(x => x.SubscriptionPlanId).GreaterThan(0).When(x => !x.FreeTrial);
        When(x => x.FreeTrial, () =>
        {
            RuleFor(x => x.TrialStartDate).NotNull().WithMessage("Choose the date the free trial starts.")
                .Must(d => d is null || d.Value.Date >= BusinessClock.Today).WithMessage("The free trial can't start in the past.");
            RuleFor(x => x.TrialEndDate).NotNull().WithMessage("Choose the date the free trial ends.");
            RuleFor(x => x).Must(x => x.TrialStartDate is null || x.TrialEndDate is null || x.TrialEndDate.Value.Date >= x.TrialStartDate.Value.Date)
                .WithName("TrialEndDate").WithMessage("The end date must be on or after the start date.");
            RuleFor(x => x).Must(x => x.TrialStartDate is null || x.TrialEndDate is null || (x.TrialEndDate.Value.Date - x.TrialStartDate.Value.Date).TotalDays < 366)
                .WithName("TrialEndDate").WithMessage("A free trial can be at most a year.");
        });
    }
}

public class UpdateStudioRequestValidator : AbstractValidator<UpdateStudioRequestDto>
{
    public UpdateStudioRequestValidator()
    {
        RuleFor(x => x.StudioName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OwnerName).MaximumLength(200);
        RuleFor(x => x.Email).EmailAddress().MaximumLength(256).When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.PhoneNumber).MaximumLength(30);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.City).MaximumLength(100);
        RuleFor(x => x.State).MaximumLength(100);
        RuleFor(x => x.Pincode).MaximumLength(20);
        RuleFor(x => x.GstNumber).MaximumLength(30);
        RuleFor(x => x.Website).MaximumLength(300)
            .Must(PublicLinks.IsValidUrl).WithMessage("Enter a valid website, e.g. www.yourstudio.com.");
        RuleFor(x => x.PhoneNumber)
            .Must(PublicLinks.IsValidPhone).WithMessage("Enter a valid phone number (digits, spaces, + or -).");
        RuleFor(x => x.WhatsAppNumber).MaximumLength(30)
            .Must(PublicLinks.IsValidWhatsApp).WithMessage("Enter the WhatsApp number with its country code, e.g. +91 98765 43210.");
        RuleFor(x => x.Description).MaximumLength(300);
        RuleFor(x => x.InstagramUrl).MaximumLength(300)
            .Must(PublicLinks.IsValidUrl).WithMessage("Enter a valid Instagram link, e.g. instagram.com/yourstudio.");
        RuleFor(x => x.FacebookUrl).MaximumLength(300)
            .Must(PublicLinks.IsValidUrl).WithMessage("Enter a valid Facebook link, e.g. facebook.com/yourstudio.");
    }
}

public class ResetStudioPasswordRequestValidator : AbstractValidator<ResetStudioPasswordRequestDto>
{
    public ResetStudioPasswordRequestValidator()
    {
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8)
            .WithMessage("The new password must be at least 8 characters.");
    }
}
