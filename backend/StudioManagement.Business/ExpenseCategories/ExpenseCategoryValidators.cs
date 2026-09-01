using FluentValidation;

namespace StudioManagement.Business.ExpenseCategories;

public class CreateExpenseCategoryRequestValidator : AbstractValidator<CreateExpenseCategoryRequestDto>
{
    public CreateExpenseCategoryRequestValidator()
    {
        RuleFor(x => x.CategoryName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}

public class UpdateExpenseCategoryRequestValidator : AbstractValidator<UpdateExpenseCategoryRequestDto>
{
    public UpdateExpenseCategoryRequestValidator()
    {
        RuleFor(x => x.CategoryName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(500);
    }
}
