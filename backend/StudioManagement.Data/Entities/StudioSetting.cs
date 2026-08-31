namespace StudioManagement.Data.Entities;

public class StudioSetting : ITenantEntity
{
    public int StudioSettingId { get; set; }
    public int StudioId { get; set; }
    public string SettingKey { get; set; } = null!;
    public string? SettingValue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Studio Studio { get; set; } = null!;
}
