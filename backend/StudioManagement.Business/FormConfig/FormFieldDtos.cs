namespace StudioManagement.Business.FormConfig;

public class FormFieldOptionDto
{
    public int FormFieldOptionId { get; set; }
    public string OptionValue { get; set; } = null!;
    public string OptionLabel { get; set; } = null!;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
}

public class FormFieldDto
{
    public int FormFieldId { get; set; }
    public string FieldKey { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string FieldType { get; set; } = null!;
    public string? Placeholder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsVisible { get; set; }
    public bool IsEnabled { get; set; }
    public int DisplayOrder { get; set; }
    public string? DefaultValue { get; set; }
    public List<FormFieldOptionDto> Options { get; set; } = [];
}

public class UpdateFormFieldRequestDto
{
    public string Label { get; set; } = null!;
    public string? Placeholder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsVisible { get; set; } = true;
    public bool IsEnabled { get; set; } = true;
    public int DisplayOrder { get; set; }
}

public class CreateCustomFieldRequestDto
{
    public string FieldKey { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string FieldType { get; set; } = null!;
    public string? Placeholder { get; set; }
    public bool IsRequired { get; set; }
    public int DisplayOrder { get; set; }
    public List<string>? Options { get; set; }
}
