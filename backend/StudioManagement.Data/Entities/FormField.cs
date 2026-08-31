namespace StudioManagement.Data.Entities;

public class FormField
{
    public int FormFieldId { get; set; }
    public int FormDefinitionId { get; set; }
    public string FieldKey { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string FieldType { get; set; } = null!;
    public string? Placeholder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsVisible { get; set; } = true;
    public bool IsEnabled { get; set; } = true;
    public int DisplayOrder { get; set; }
    public string? DefaultValue { get; set; }
    public string? ValidationRules { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public FormDefinition FormDefinition { get; set; } = null!;
    public ICollection<FormFieldOption> Options { get; set; } = new List<FormFieldOption>();
    public ICollection<CustomFieldValue> CustomFieldValues { get; set; } = new List<CustomFieldValue>();
}
