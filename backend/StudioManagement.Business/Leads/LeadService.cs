using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Business.Notifications;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Leads;

public class LeadService(
    ILeadRepository leadRepository,
    ICustomerRepository customerRepository,
    IAuditService auditService,
    INotificationService notificationService,
    IUnitOfWork unitOfWork) : ILeadService
{
    private const string Module = "Enquiry";

    public async Task<PagedResult<LeadDto>> SearchAsync(
        int studioId, string? search, int? leadStatusId, DateTime? createdFrom, DateTime? createdTo, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await leadRepository.SearchAsync(studioId, search, leadStatusId, createdFrom, createdTo, page, pageSize, ct);
        return new PagedResult<LeadDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<LeadDto?> GetByIdAsync(int studioId, int leadId, CancellationToken ct = default)
    {
        var lead = await leadRepository.GetByIdAsync(studioId, leadId, ct);
        return lead is null ? null : MapToDto(lead);
    }

    public async Task<LeadDto> CreateAsync(int studioId, CreateLeadRequestDto request, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var lead = new Lead
        {
            StudioId = studioId,
            FullName = request.FullName,
            MobileNumber = request.MobileNumber,
            Email = request.Email,
            EventTypeId = request.EventTypeId,
            LeadSourceId = request.LeadSourceId,
            LeadStatusId = request.LeadStatusId,
            ExpectedEventDate = request.ExpectedEventDate,
            ExpectedBudget = request.ExpectedBudget,
            Location = request.Location,
            Notes = request.Notes,
            FollowUpDate = request.FollowUpDate,
            CreatedAt = now,
            UpdatedAt = now
        };

        await leadRepository.AddAsync(lead, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Enquiry created", Module, studioId, ct);
        await notificationService.NotifyAsync(studioId, "New enquiry", $"New enquiry: {lead.FullName} ({lead.MobileNumber})", NotificationTypes.LeadCreated, ct);

        var created = await leadRepository.GetByIdAsync(studioId, lead.LeadId, ct);
        return MapToDto(created!);
    }

    public async Task<LeadDto?> UpdateAsync(int studioId, int leadId, UpdateLeadRequestDto request, CancellationToken ct = default)
    {
        var lead = await leadRepository.GetByIdAsync(studioId, leadId, ct);
        if (lead is null)
        {
            return null;
        }

        lead.FullName = request.FullName;
        lead.MobileNumber = request.MobileNumber;
        lead.Email = request.Email;
        lead.EventTypeId = request.EventTypeId;
        lead.LeadSourceId = request.LeadSourceId;
        lead.LeadStatusId = request.LeadStatusId;
        lead.ExpectedEventDate = request.ExpectedEventDate;
        lead.ExpectedBudget = request.ExpectedBudget;
        lead.Location = request.Location;
        lead.Notes = request.Notes;
        lead.FollowUpDate = request.FollowUpDate;
        lead.UpdatedAt = DateTime.UtcNow;

        leadRepository.Update(lead);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Enquiry updated", Module, studioId, ct);

        return MapToDto(lead);
    }

    public async Task<bool> DeleteAsync(int studioId, int leadId, CancellationToken ct = default)
    {
        var lead = await leadRepository.GetByIdAsync(studioId, leadId, ct);
        if (lead is null)
        {
            return false;
        }

        leadRepository.Remove(lead);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Enquiry deleted", Module, studioId, ct);
        return true;
    }

    public async Task<LeadConversionResult> ConvertToCustomerAsync(int studioId, int leadId, CancellationToken ct = default)
    {
        var lead = await leadRepository.GetByIdAsync(studioId, leadId, ct);
        if (lead is null)
        {
            return LeadConversionResult.Fail(LeadConversionFailureReason.NotFound);
        }

        if (lead.ConvertedCustomerId is not null)
        {
            return LeadConversionResult.Fail(LeadConversionFailureReason.AlreadyConverted);
        }

        var now = DateTime.UtcNow;

        // Someone already a customer under this mobile number: the enquiry is linked to them rather
        // than creating a duplicate customer.
        var digits = new string(lead.MobileNumber.Where(char.IsDigit).ToArray());
        var existing = digits.Length == 0 ? null : await customerRepository.FindByMobileDigitsAsync(studioId, digits, null, ct);
        if (existing is not null)
        {
            lead.ConvertedCustomerId = existing.CustomerId;
            lead.UpdatedAt = now;
            leadRepository.Update(lead);
            await unitOfWork.SaveChangesAsync(ct);
            await auditService.LogAsync("Enquiry linked to existing customer", Module, studioId, ct);
            await notificationService.NotifyAsync(studioId, "Enquiry converted",
                $"{lead.FullName} matched existing customer {existing.FullName} (same mobile number).", NotificationTypes.LeadConverted, ct);
            return LeadConversionResult.Success(MapToDto(lead), existing.CustomerId);
        }

        var customer = new Customer
        {
            StudioId = studioId,
            FullName = lead.FullName,
            MobileNumber = lead.MobileNumber,
            Email = lead.Email,
            Address = lead.Location,
            Notes = lead.Notes,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        // Assigning the navigation (rather than ConvertedCustomerId) lets EF Core insert the
        // customer and fix up the lead's FK in a single SaveChanges call.
        lead.ConvertedCustomer = customer;
        lead.UpdatedAt = now;
        await customerRepository.AddAsync(customer, ct);
        leadRepository.Update(lead);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogAsync("Enquiry converted to customer", Module, studioId, ct);
        await notificationService.NotifyAsync(studioId, "Enquiry converted", $"{lead.FullName} is now a customer.", NotificationTypes.LeadConverted, ct);
        return LeadConversionResult.Success(MapToDto(lead), customer.CustomerId);
    }

    private static LeadDto MapToDto(Lead lead) => new()
    {
        LeadId = lead.LeadId,
        FullName = lead.FullName,
        MobileNumber = lead.MobileNumber,
        Email = lead.Email,
        EventTypeId = lead.EventTypeId,
        EventTypeName = lead.EventType?.Name,
        LeadSourceId = lead.LeadSourceId,
        LeadSourceName = lead.LeadSource?.Name,
        LeadStatusId = lead.LeadStatusId,
        LeadStatusName = lead.LeadStatus?.Name,
        ExpectedEventDate = lead.ExpectedEventDate,
        ExpectedBudget = lead.ExpectedBudget,
        Location = lead.Location,
        Notes = lead.Notes,
        FollowUpDate = lead.FollowUpDate,
        ConvertedCustomerId = lead.ConvertedCustomerId,
        CreatedAt = lead.CreatedAt,
        UpdatedAt = lead.UpdatedAt
    };
}
