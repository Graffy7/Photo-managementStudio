using FluentValidation;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Expenses;

public class CreateExpenseRequestValidator : AbstractValidator<CreateExpenseRequestDto>
{
    public CreateExpenseRequestValidator()
    {
        RuleFor(x => x.ExpenseCategoryId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.ExpenseDate).NotEqual(default(DateTime));
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.PaymentMethod).MaximumLength(30);
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
        RuleFor(x => x.VendorName).MaximumLength(150);
        RuleFor(x => x.Amount).LessThanOrEqualTo(999_999_999m).WithMessage("The amount is too large.");
        RuleFor(x => x.PaymentStatus)
            .Must(s => string.IsNullOrEmpty(s) || ExpensePaymentStatuses.All.Contains(s))
            .WithMessage("Payment status must be Paid or Pending.");
    }
}

public class UpdateExpenseRequestValidator : AbstractValidator<UpdateExpenseRequestDto>
{
    public UpdateExpenseRequestValidator()
    {
        RuleFor(x => x.ExpenseCategoryId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.ExpenseDate).NotEqual(default(DateTime));
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.PaymentMethod).MaximumLength(30);
        RuleFor(x => x.ReferenceNumber).MaximumLength(100);
        RuleFor(x => x.VendorName).MaximumLength(150);
        RuleFor(x => x.Amount).LessThanOrEqualTo(999_999_999m).WithMessage("The amount is too large.");
        RuleFor(x => x.PaymentStatus)
            .Must(s => string.IsNullOrEmpty(s) || ExpensePaymentStatuses.All.Contains(s))
            .WithMessage("Payment status must be Paid or Pending.");
    }
}
