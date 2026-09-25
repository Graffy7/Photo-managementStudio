using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Auth;

public class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequestDto>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public class SendResetCodeRequestValidator : AbstractValidator<SendResetCodeRequestDto>
{
    public SendResetCodeRequestValidator()
    {
        RuleFor(x => x.Channel).NotEmpty().Must(c => PasswordResetChannels.All.Contains(c))
            .WithMessage("Choose email or phone.");
        RuleFor(x => x.Identifier).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Identifier).EmailAddress().When(x => x.Channel == PasswordResetChannels.Email)
            .WithMessage("Enter a valid email address.");
        RuleFor(x => x.Identifier).Must(v => v.Count(char.IsDigit) is >= 10 and <= 15)
            .When(x => x.Channel == PasswordResetChannels.Phone && !string.IsNullOrEmpty(x.Identifier))
            .WithMessage("Enter a valid phone number.");
    }
}

public class VerifyResetCodeRequestValidator : AbstractValidator<VerifyResetCodeRequestDto>
{
    public VerifyResetCodeRequestValidator()
    {
        RuleFor(x => x.Channel).NotEmpty().Must(c => PasswordResetChannels.All.Contains(c))
            .WithMessage("Choose email or phone.");
        RuleFor(x => x.Identifier).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Code).NotEmpty().Matches(@"^\s*\d{6}\s*$").WithMessage("Enter the 6-digit code.");
    }
}

public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequestDto>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
        RuleFor(x => x.ConfirmPassword).Equal(x => x.NewPassword).WithMessage("Passwords do not match.");
    }
}

public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequestDto>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).NotEqual(x => x.CurrentPassword).WithMessage("New password must be different from the current password.");
        RuleFor(x => x.ConfirmPassword).Equal(x => x.NewPassword).WithMessage("Passwords do not match.");
    }
}

public class RefreshRequestValidator : AbstractValidator<RefreshRequestDto>
{
    public RefreshRequestValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}

public class LogoutRequestValidator : AbstractValidator<LogoutRequestDto>
{
    public LogoutRequestValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}
