namespace StudioManagement.Data.Entities;

public class FormFieldOption
{
    public int FormFieldOptionId { get; set; }
    public int FormFieldId { get; set; }
    public string OptionValue { get; set; } = null!;
    public string OptionLabel { get; set; } = null!;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public FormField FormField { get; set; } = null!;
}
