using FluentValidation;

namespace StudioManagement.Business.Events;

// One line of the delivery checklist as the app shows it. ItemId is 0 for a standard item nobody
// has touched yet: there is no row for it until it is first ticked.
public class EventDeliveryItemDto
{
    public int ItemId { get; set; }
    public string? ItemKey { get; set; }
    public string Name { get; set; } = null!;
    public bool IsDelivered { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public bool IsCustom { get; set; }
}

public class AddDeliveryItemRequestDto
{
    public string Name { get; set; } = null!;
}

// Either ItemId (an item that already has a row) or ItemKey (a standard item being ticked for the
// first time) identifies the line being changed.
public class SetDeliveryStatusRequestDto
{
    public int ItemId { get; set; }
    public string? ItemKey { get; set; }
    public bool IsDelivered { get; set; }
}

public class AddDeliveryItemRequestValidator : AbstractValidator<AddDeliveryItemRequestDto>
{
    public AddDeliveryItemRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}

public class SetDeliveryStatusRequestValidator : AbstractValidator<SetDeliveryStatusRequestDto>
{
    public SetDeliveryStatusRequestValidator()
    {
        RuleFor(x => x).Must(x => x.ItemId > 0 || !string.IsNullOrWhiteSpace(x.ItemKey))
            .WithMessage("Either ItemId or ItemKey is required.");
        RuleFor(x => x.ItemKey).MaximumLength(30);
    }
}
