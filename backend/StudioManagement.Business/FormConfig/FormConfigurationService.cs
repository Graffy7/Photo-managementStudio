using StudioManagement.Business.Audit;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.FormConfig;

public class FormConfigurationService(
    IFormDefinitionRepository formDefinitionRepository,
    IRepository<FormField> formFieldRepository,
    IRepository<FormFieldOption> formFieldOptionRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : IFormConfigurationService
{
    private const string Module = "FormConfig";
    public async Task<List<FormFieldDto>?> GetFieldsAsync(int studioId, string formCode, CancellationToken ct = default)
    {
        if (!FormCodes.All.Contains(formCode))
        {
            return null;
        }

        var definition = await formDefinitionRepository.FindByCodeAsync(studioId, formCode, ct)
            ?? await ProvisionDefaultsAsync(studioId, formCode, ct);

        return definition.FormFields
            .OrderBy(f => f.DisplayOrder)
            .Select(ToDto)
            .ToList();
    }

    public async Task<FormFieldDto?> UpdateFieldAsync(int studioId, string formCode, int formFieldId, UpdateFormFieldRequestDto request, CancellationToken ct = default)
    {
        var definition = await formDefinitionRepository.FindByCodeAsync(studioId, formCode, ct);
        var field = definition?.FormFields.FirstOrDefault(f => f.FormFieldId == formFieldId);
        if (field is null)
        {
            return null;
        }

        field.Label = request.Label;
        field.Placeholder = request.Placeholder;
        field.IsRequired = request.IsRequired;
        field.IsVisible = request.IsVisible;
        field.IsEnabled = request.IsEnabled;
        field.DisplayOrder = request.DisplayOrder;
        field.UpdatedAt = DateTime.UtcNow;

        formFieldRepository.Update(field);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Form field updated: {field.Label} ({formCode})", Module, studioId, ct);
        return ToDto(field);
    }

    public async Task<FormFieldDto?> AddCustomFieldAsync(int studioId, string formCode, CreateCustomFieldRequestDto request, CancellationToken ct = default)
    {
        var definition = await formDefinitionRepository.FindByCodeAsync(studioId, formCode, ct)
            ?? await ProvisionDefaultsAsync(studioId, formCode, ct);

        var now = DateTime.UtcNow;
        var field = new FormField
        {
            FormDefinitionId = definition.FormDefinitionId,
            FieldKey = request.FieldKey,
            Label = request.Label,
            FieldType = request.FieldType,
            Placeholder = request.Placeholder,
            IsRequired = request.IsRequired,
            IsVisible = true,
            IsEnabled = true,
            DisplayOrder = request.DisplayOrder,
            CreatedAt = now,
            UpdatedAt = now
        };
        await formFieldRepository.AddAsync(field, ct);
        await unitOfWork.SaveChangesAsync(ct);

        if (request.Options is { Count: > 0 })
        {
            var order = 0;
            foreach (var optionLabel in request.Options)
            {
                await formFieldOptionRepository.AddAsync(new FormFieldOption
                {
                    FormFieldId = field.FormFieldId,
                    OptionValue = optionLabel,
                    OptionLabel = optionLabel,
                    DisplayOrder = order++,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now
                }, ct);
            }
            await unitOfWork.SaveChangesAsync(ct);
        }

        await auditService.LogAsync($"Custom form field added: {field.Label} ({formCode})", Module, studioId, ct);
        return ToDto(field);
    }

    private async Task<FormDefinition> ProvisionDefaultsAsync(int studioId, string formCode, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var definition = new FormDefinition
        {
            StudioId = studioId,
            FormCode = formCode,
            FormName = formCode == FormCodes.LeadForm ? "Lead Form" : formCode,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
            FormFields = DefaultFieldsFor(formCode, now)
        };

        // FormDefinition isn't exposed by the generic tenant repository set used elsewhere in this
        // service, so it's added directly via its own repository here.
        await formDefinitionRepository.AddAsync(definition, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return definition;
    }

    private static List<FormField> DefaultFieldsFor(string formCode, DateTime now)
    {
        if (formCode != FormCodes.LeadForm)
        {
            return [];
        }

        FormField Field(string key, string label, string type, bool required, int order, string? placeholder = null) => new()
        {
            FieldKey = key,
            Label = label,
            FieldType = type,
            Placeholder = placeholder,
            IsRequired = required,
            IsVisible = true,
            IsEnabled = true,
            DisplayOrder = order,
            CreatedAt = now,
            UpdatedAt = now
        };

        return
        [
            Field("FullName", "Full Name", FieldTypes.Text, true, 1),
            Field("MobileNumber", "Mobile Number", FieldTypes.Phone, true, 2),
            Field("Email", "Email", FieldTypes.Email, false, 3),
            Field("EventTypeId", "Event Type", FieldTypes.Dropdown, false, 4),
            Field("LeadSourceId", "Lead Source", FieldTypes.Dropdown, false, 5),
            Field("LeadStatusId", "Lead Status", FieldTypes.Dropdown, false, 6),
            Field("ExpectedEventDate", "Expected Event Date", FieldTypes.Date, false, 7),
            Field("ExpectedBudget", "Expected Budget", FieldTypes.Number, false, 8),
            Field("Location", "Location", FieldTypes.Text, false, 9),
            Field("Notes", "Notes", FieldTypes.TextArea, false, 10),
            Field("FollowUpDate", "Follow-up Date", FieldTypes.Date, false, 11)
        ];
    }

    private static FormFieldDto ToDto(FormField field) => new()
    {
        FormFieldId = field.FormFieldId,
        FieldKey = field.FieldKey,
        Label = field.Label,
        FieldType = field.FieldType,
        Placeholder = field.Placeholder,
        IsRequired = field.IsRequired,
        IsVisible = field.IsVisible,
        IsEnabled = field.IsEnabled,
        DisplayOrder = field.DisplayOrder,
        DefaultValue = field.DefaultValue,
        Options = field.Options
            .Where(o => o.IsActive)
            .OrderBy(o => o.DisplayOrder)
            .Select(o => new FormFieldOptionDto
            {
                FormFieldOptionId = o.FormFieldOptionId,
                OptionValue = o.OptionValue,
                OptionLabel = o.OptionLabel,
                DisplayOrder = o.DisplayOrder,
                IsActive = o.IsActive
            }).ToList()
    };
}
