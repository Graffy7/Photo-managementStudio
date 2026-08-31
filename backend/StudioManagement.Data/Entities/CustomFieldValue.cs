namespace StudioManagement.Data.Entities;

public class CustomFieldValue : ITenantEntity
{
    public int CustomFieldValueId { get; set; }
    public int StudioId { get; set; }
    public int FormDefinitionId { get; set; }
    public int FormFieldId { get; set; }
    public string EntityType { get; set; } = null!;
    public int EntityId { get; set; }
    public string? Value { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public FormDefinition FormDefinition { get; set; } = null!;
    public FormField FormField { get; set; } = null!;
}
