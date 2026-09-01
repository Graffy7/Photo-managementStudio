using FluentValidation;

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
    }
}
