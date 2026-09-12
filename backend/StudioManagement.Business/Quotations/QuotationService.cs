using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Business.Notifications;
using StudioManagement.Business.Settings;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Quotations;

public class QuotationService(
    IQuotationRepository quotationRepository,
    ICustomerRepository customerRepository,
    IEventRepository eventRepository,
    IServiceCatalogRepository serviceCatalogRepository,
    IAuditService auditService,
    INotificationService notificationService,
    IStudioSettingsService studioSettingsService,
    IUnitOfWork unitOfWork) : IQuotationService
{
    private const string Module = "Quotations";

    public async Task<PagedResult<QuotationDto>> SearchAsync(int studioId, string? search, string? status, int? customerId, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await quotationRepository.SearchAsync(studioId, search, status, customerId, page, pageSize, ct);
        return new PagedResult<QuotationDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<QuotationDto?> GetByIdAsync(int studioId, int quotationId, CancellationToken ct = default)
    {
        var quotation = await quotationRepository.GetByIdAsync(studioId, quotationId, ct);
        return quotation is null ? null : MapToDto(quotation);
    }

    public async Task<QuotationWriteResult> CreateAsync(int studioId, CreateQuotationRequestDto request, CancellationToken ct = default)
    {
        var failure = await ValidateReferencesAsync(studioId, request.CustomerId, request.EventId, request.Items, ct);
        if (failure is not null)
        {
            return QuotationWriteResult.Fail(failure.Value);
        }

        var items = request.Items.Select(i => new QuotationItem
        {
            ServiceId = i.ServiceId,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            Total = i.Quantity * i.UnitPrice,
            Notes = i.Notes
        }).ToList();

        var settings = await studioSettingsService.GetQuotationSettingsAsync(studioId, ct);
        var subtotal = items.Sum(i => i.Total);
        var existingCount = await quotationRepository.CountAllAsync(studioId, ct);
        var sequence = settings.StartingNumber + existingCount;
        var now = DateTime.UtcNow;

        var businessSettings = await studioSettingsService.GetBusinessSettingsAsync(studioId, ct);
        var validUntil = request.ValidUntil ?? request.QuotationDate.AddDays(businessSettings.QuotationValidityDays);

        var quotation = new Quotation
        {
            StudioId = studioId,
            QuotationNumber = $"{settings.Prefix}{sequence:000000}",
            CustomerId = request.CustomerId,
            EventId = request.EventId,
            QuotationDate = request.QuotationDate,
            ValidUntil = validUntil,
            Subtotal = subtotal,
            Discount = request.Discount,
            TaxAmount = request.TaxAmount,
            GrandTotal = subtotal - request.Discount + request.TaxAmount,
            Status = request.Status,
            TermsAndConditions = request.TermsAndConditions,
            CreatedAt = now,
            UpdatedAt = now,
            Items = items
        };

        await quotationRepository.AddAsync(quotation, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Quotation created", Module, studioId, ct);

        var created = await quotationRepository.GetByIdAsync(studioId, quotation.QuotationId, ct);
        var dto = MapToDto(created!);

        if (quotation.Status == QuotationStatuses.Accepted)
        {
            await notificationService.NotifyAsync(
                studioId, "Quotation accepted", $"Quotation {dto.QuotationNumber} accepted — ₹{dto.GrandTotal:N0}", NotificationTypes.QuotationAccepted, ct);
        }

        return QuotationWriteResult.Success(dto);
    }

    public async Task<QuotationWriteResult?> UpdateAsync(int studioId, int quotationId, UpdateQuotationRequestDto request, CancellationToken ct = default)
    {
        var quotation = await quotationRepository.GetByIdAsync(studioId, quotationId, ct);
        if (quotation is null)
        {
            return null;
        }

        var failure = await ValidateReferencesAsync(studioId, request.CustomerId, request.EventId, request.Items, ct);
        if (failure is not null)
        {
            return QuotationWriteResult.Fail(failure.Value);
        }

        // Required (non-nullable FK) relationship with cascade delete configured — clearing the
        // navigation is enough for EF to delete the orphaned rows on SaveChanges.
        quotation.Items.Clear();
        foreach (var i in request.Items)
        {
            quotation.Items.Add(new QuotationItem
            {
                ServiceId = i.ServiceId,
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice,
                Total = i.Quantity * i.UnitPrice,
                Notes = i.Notes
            });
        }

        var subtotal = quotation.Items.Sum(i => i.Total);
        var previousStatus = quotation.Status;

        quotation.CustomerId = request.CustomerId;
        quotation.EventId = request.EventId;
        quotation.QuotationDate = request.QuotationDate;
        quotation.ValidUntil = request.ValidUntil;
        quotation.Subtotal = subtotal;
        quotation.Discount = request.Discount;
        quotation.TaxAmount = request.TaxAmount;
        quotation.GrandTotal = subtotal - request.Discount + request.TaxAmount;
        quotation.Status = request.Status;
        quotation.TermsAndConditions = request.TermsAndConditions;
        quotation.UpdatedAt = DateTime.UtcNow;

        quotationRepository.Update(quotation);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Quotation updated", Module, studioId, ct);

        var updated = await quotationRepository.GetByIdAsync(studioId, quotationId, ct);
        var dto = MapToDto(updated!);

        if (quotation.Status == QuotationStatuses.Accepted && previousStatus != QuotationStatuses.Accepted)
        {
            await notificationService.NotifyAsync(
                studioId, "Quotation accepted", $"Quotation {dto.QuotationNumber} accepted — ₹{dto.GrandTotal:N0}", NotificationTypes.QuotationAccepted, ct);
        }

        return QuotationWriteResult.Success(dto);
    }

    public async Task<QuotationDto?> SetStatusAsync(int studioId, int quotationId, string status, CancellationToken ct = default)
    {
        var quotation = await quotationRepository.GetByIdAsync(studioId, quotationId, ct);
        if (quotation is null)
        {
            return null;
        }

        var previousStatus = quotation.Status;
        quotation.Status = status;
        quotation.UpdatedAt = DateTime.UtcNow;

        quotationRepository.Update(quotation);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"Quotation status changed: {previousStatus} → {status}", Module, studioId, ct);

        var dto = MapToDto(quotation);

        if (status == QuotationStatuses.Accepted && previousStatus != QuotationStatuses.Accepted)
        {
            await notificationService.NotifyAsync(
                studioId, "Quotation accepted", $"Quotation {dto.QuotationNumber} accepted — ₹{dto.GrandTotal:N0}", NotificationTypes.QuotationAccepted, ct);
        }

        return dto;
    }

    private async Task<QuotationWriteFailureReason?> ValidateReferencesAsync(int studioId, int customerId, int? eventId, List<QuotationItemRequestDto> items, CancellationToken ct)
    {
        var customer = await customerRepository.GetByIdAsync(studioId, customerId, ct);
        if (customer is null)
        {
            return QuotationWriteFailureReason.CustomerNotFound;
        }

        if (eventId is not null)
        {
            var evt = await eventRepository.GetByIdAsync(studioId, eventId.Value, ct);
            if (evt is null)
            {
                return QuotationWriteFailureReason.EventNotFound;
            }
        }

        foreach (var serviceId in items.Select(i => i.ServiceId).Distinct())
        {
            var service = await serviceCatalogRepository.GetByIdAsync(studioId, serviceId, ct);
            if (service is null)
            {
                return QuotationWriteFailureReason.ServiceNotFound;
            }
        }

        return null;
    }

    private static QuotationDto MapToDto(Quotation quotation) => new()
    {
        QuotationId = quotation.QuotationId,
        QuotationNumber = quotation.QuotationNumber,
        CustomerId = quotation.CustomerId,
        CustomerName = quotation.Customer.FullName,
        CustomerMobileNumber = quotation.Customer.MobileNumber,
        EventId = quotation.EventId,
        EventVenue = quotation.Event?.Venue,
        QuotationDate = quotation.QuotationDate,
        ValidUntil = quotation.ValidUntil,
        Subtotal = quotation.Subtotal,
        Discount = quotation.Discount,
        TaxAmount = quotation.TaxAmount,
        GrandTotal = quotation.GrandTotal,
        Status = quotation.Status,
        TermsAndConditions = quotation.TermsAndConditions,
        Items = quotation.Items.Select(i => new QuotationItemDto
        {
            QuotationItemId = i.QuotationItemId,
            ServiceId = i.ServiceId,
            ServiceName = i.Service.ServiceName,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            Total = i.Total,
            Notes = i.Notes
        }).ToList(),
        CreatedAt = quotation.CreatedAt,
        UpdatedAt = quotation.UpdatedAt
    };
}
