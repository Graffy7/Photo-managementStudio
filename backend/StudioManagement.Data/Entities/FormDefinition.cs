namespace StudioManagement.Data.Entities;

public class FormDefinition : ITenantEntity
{
    public int FormDefinitionId { get; set; }
    public int StudioId { get; set; }
    public string FormCode { get; set; } = null!;
    public string FormName { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
    public ICollection<FormField> FormFields { get; set; } = new List<FormField>();
}
