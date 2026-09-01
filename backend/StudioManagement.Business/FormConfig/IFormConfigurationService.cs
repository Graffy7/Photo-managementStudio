namespace StudioManagement.Business.FormConfig;

public interface IFormConfigurationService
{
    Task<List<FormFieldDto>?> GetFieldsAsync(int studioId, string formCode, CancellationToken ct = default);
    Task<FormFieldDto?> UpdateFieldAsync(int studioId, string formCode, int formFieldId, UpdateFormFieldRequestDto request, CancellationToken ct = default);
    Task<FormFieldDto?> AddCustomFieldAsync(int studioId, string formCode, CreateCustomFieldRequestDto request, CancellationToken ct = default);
}
