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
            ServiceId = (i.ServiceId ?? 0) > 0 ? i.ServiceId : null,
            CustomName = (i.ServiceId ?? 0) > 0 ? null : i.CustomName?.Trim(),
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
            GrandTotal = GrandTotalFor(subtotal, request.Discount, request.TaxAmount, ManualTotalFor(request.PriceDisplay, request.ManualTotal)),
            Status = request.Status,
            TermsAndConditions = request.TermsAndConditions,
            PriceDisplay = NormalizePriceDisplay(request.PriceDisplay) ?? QuotationPriceDisplays.Detailed,
            ManualTotal = ManualTotalFor(request.PriceDisplay, request.ManualTotal),
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
                ServiceId = (i.ServiceId ?? 0) > 0 ? i.ServiceId : null,
                CustomName = (i.ServiceId ?? 0) > 0 ? null : i.CustomName?.Trim(),
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
        // An older client that sends neither field keeps the quotation's display and manual total.
        if (request.PriceDisplay is not null)
        {
            quotation.ManualTotal = ManualTotalFor(request.PriceDisplay, request.ManualTotal);
        }
        quotation.GrandTotal = GrandTotalFor(subtotal, request.Discount, request.TaxAmount, quotation.ManualTotal);
        quotation.Status = request.Status;
        quotation.TermsAndConditions = request.TermsAndConditions;
        // Left as it was when the form doesn't send it (older clients).
        quotation.PriceDisplay = NormalizePriceDisplay(request.PriceDisplay) ?? quotation.PriceDisplay;
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

    // Changes only how this quotation's PDF shows prices; items, prices and totals are untouched.
    public async Task<QuotationDto?> SetPriceDisplayAsync(int studioId, int quotationId, string priceDisplay, CancellationToken ct = default)
    {
        var quotation = await quotationRepository.GetByIdAsync(studioId, quotationId, ct);
        var value = NormalizePriceDisplay(priceDisplay);
        if (quotation is null || value is null)
        {
            return null;
        }

        // A manual total only makes sense as "Total only": the listed prices wouldn't add up to it.
        if (value == QuotationPriceDisplays.Detailed && quotation.ManualTotal is not null)
        {
            throw new InvalidOperationException(ManualTotalLocksDisplay);
        }

        if (quotation.PriceDisplay != value)
        {
            quotation.PriceDisplay = value;
            quotation.UpdatedAt = DateTime.UtcNow;
            quotationRepository.Update(quotation);
            await unitOfWork.SaveChangesAsync(ct);
        }
        return MapToDto(quotation);
    }

    public const string ManualTotalLocksDisplay =
        "This quotation has a manually entered total, so it prints as Total only. Edit the quotation and clear the manual total to show detailed prices.";

    // The manual total counts only on a "Total only" quotation.
    private static decimal? ManualTotalFor(string? priceDisplay, decimal? manualTotal) =>
        NormalizePriceDisplay(priceDisplay) == QuotationPriceDisplays.TotalOnly && manualTotal is > 0 ? manualTotal : null;

    // The usual calculation, unless a total was entered by hand.
    private static decimal GrandTotalFor(decimal subtotal, decimal discount, decimal tax, decimal? manualTotal) =>
        manualTotal ?? subtotal - discount + tax;

    private static string? NormalizePriceDisplay(string? value) =>
        QuotationPriceDisplays.All.FirstOrDefault(v => string.Equals(v, value, StringComparison.OrdinalIgnoreCase));

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

        foreach (var serviceId in items.Where(i => (i.ServiceId ?? 0) > 0).Select(i => i.ServiceId!.Value).Distinct())
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
        PriceDisplay = quotation.PriceDisplay,
        ManualTotal = quotation.ManualTotal,
        Items = quotation.Items.Select(i => new QuotationItemDto
        {
            QuotationItemId = i.QuotationItemId,
            ServiceId = i.ServiceId,
            ServiceName = i.Service?.ServiceName ?? i.CustomName ?? "Item",
            IsCustom = i.ServiceId is null,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            Total = i.Total,
            Notes = i.Notes
        }).ToList(),
        CreatedAt = quotation.CreatedAt,
        UpdatedAt = quotation.UpdatedAt
    };
}
