using StudioManagement.Business.Audit;
using StudioManagement.Business.Common;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Customers;

public class CustomerService(
    ICustomerRepository customerRepository,
    IEventRepository eventRepository,
    IAuditService auditService,
    IUnitOfWork unitOfWork) : ICustomerService
{
    private const string Module = "Customers";

    public async Task<PagedResult<CustomerDto>> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default, ListSort? sort = null)
    {
        page = Math.Clamp(page, 1, 100_000); // upper bound keeps (page - 1) * pageSize from overflowing
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await customerRepository.SearchAsync(studioId, search, isActive, page, pageSize, ct, sort);
        return new PagedResult<CustomerDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<CustomerDto?> GetByIdAsync(int studioId, int customerId, CancellationToken ct = default)
    {
        var customer = await customerRepository.GetByIdAsync(studioId, customerId, ct);
        return customer is null ? null : MapToDto(customer);
    }

    public async Task<CustomerDto?> FindMobileDuplicateAsync(int studioId, string mobileNumber, int? excludeCustomerId, CancellationToken ct = default)
    {
        var digits = new string(mobileNumber.Where(char.IsDigit).ToArray());
        if (digits.Length == 0)
        {
            return null;
        }
        var existing = await customerRepository.FindByMobileDigitsAsync(studioId, digits, excludeCustomerId, ct);
        return existing is null ? null : MapToDto(existing);
    }

    public async Task<CustomerDto> CreateAsync(int studioId, CreateCustomerRequestDto request, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var customer = new Customer
        {
            StudioId = studioId,
            FullName = request.FullName,
            MobileNumber = request.MobileNumber,
            Email = request.Email,
            Address = request.Address,
            Notes = request.Notes,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        // One customer per mobile number: checked and saved under a lock on that number, so two
        // devices saving the same new customer at the same moment can't both create one.
        await unitOfWork.ExecuteInTransactionAsync(async tx =>
        {
            await unitOfWork.AcquireLockAsync(LockNames.CustomerMobile(studioId, request.MobileNumber), tx);
            await ThrowIfMobileTakenAsync(studioId, request.MobileNumber, null, tx);
            await customerRepository.AddAsync(customer, tx);
            await unitOfWork.SaveChangesAsync(tx);
            return true;
        }, ct);
        await auditService.LogAsync("Customer created", Module, studioId, ct);

        return MapToDto(customer);
    }

    public async Task<CustomerDto?> UpdateAsync(int studioId, int customerId, UpdateCustomerRequestDto request, CancellationToken ct = default)
    {
        var customer = await customerRepository.GetByIdAsync(studioId, customerId, ct);
        if (customer is null)
        {
            return null;
        }

        var originalMobile = customer.MobileNumber;
        customer.FullName = request.FullName;
        customer.MobileNumber = request.MobileNumber;
        customer.Email = request.Email;
        customer.Address = request.Address;
        customer.Notes = request.Notes;
        customer.UpdatedAt = DateTime.UtcNow;

        // A changed number is checked and saved under the same lock new customers use.
        if (Digits(customer.MobileNumber) != Digits(originalMobile))
        {
            await unitOfWork.ExecuteInTransactionAsync(async tx =>
            {
                await unitOfWork.AcquireLockAsync(LockNames.CustomerMobile(studioId, customer.MobileNumber), tx);
                await ThrowIfMobileTakenAsync(studioId, customer.MobileNumber, customerId, tx);
                customerRepository.Update(customer);
                await unitOfWork.SaveChangesAsync(tx);
                return true;
            }, ct);
        }
        else
        {
            customerRepository.Update(customer);
            await unitOfWork.SaveChangesAsync(ct);
        }
        await auditService.LogAsync("Customer updated", Module, studioId, ct);

        return MapToDto(customer);
    }

    public async Task<CustomerDto?> SetActiveAsync(int studioId, int customerId, bool isActive, CancellationToken ct = default)
    {
        var customer = await customerRepository.GetByIdAsync(studioId, customerId, ct);
        if (customer is null)
        {
            return null;
        }

        customer.IsActive = isActive;
        customer.UpdatedAt = DateTime.UtcNow;

        customerRepository.Update(customer);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync(isActive ? "Customer activated" : "Customer deactivated", Module, studioId, ct);

        return MapToDto(customer);
    }

    public async Task<List<CustomerEventSummaryDto>> GetEventsAsync(int studioId, int customerId, CancellationToken ct = default)
    {
        const string TimeFormat = @"hh\:mm";
        var events = await eventRepository.GetForCustomerAsync(studioId, customerId, ct);

        return events.Select(e =>
        {
            var amountPaid = e.Payments.Where(p => p.PaymentStatus == PaymentStatuses.Completed).Sum(p => p.Amount);
            return new CustomerEventSummaryDto
            {
                EventId = e.EventId,
                EventTypeName = e.EventType?.Name,
                EventDate = e.EventDate,
                StartTime = e.StartTime?.ToString(TimeFormat),
                EndTime = e.EndTime?.ToString(TimeFormat),
                Venue = e.Venue,
                VenueAddress = e.VenueAddress,
                EventStatus = e.EventStatus,
                Budget = e.Budget,
                AmountPaid = amountPaid,
                Balance = (e.Budget ?? 0) - amountPaid,
                WorkerCount = e.EventWorkers.Count,
                Notes = e.Notes,
                ApprovedAmount = e.Quotations
                    .Where(q => q.Status == QuotationStatuses.Accepted)
                    .OrderBy(q => q.QuotationDate).ThenBy(q => q.QuotationId)
                    .Select(q => (decimal?)q.GrandTotal)
                    .LastOrDefault(),
                QuotationCount = e.Quotations.Count,
                CompletedAt = e.CompletedAt
            };
        }).ToList();
    }

    private async Task ThrowIfMobileTakenAsync(int studioId, string mobileNumber, int? excludeCustomerId, CancellationToken ct)
    {
        var digits = Digits(mobileNumber);
        if (digits.Length == 0)
        {
            return;
        }
        var existing = await customerRepository.FindByMobileDigitsAsync(studioId, digits, excludeCustomerId, ct);
        if (existing is not null)
        {
            throw new DuplicateCustomerException(MapToDto(existing));
        }
    }

    private static string Digits(string? value) => new((value ?? "").Where(char.IsDigit).ToArray());

    private static CustomerDto MapToDto(Customer customer) => new()
    {
        CustomerId = customer.CustomerId,
        FullName = customer.FullName,
        MobileNumber = customer.MobileNumber,
        Email = customer.Email,
        Address = customer.Address,
        Notes = customer.Notes,
        IsActive = customer.IsActive,
        CreatedAt = customer.CreatedAt,
        UpdatedAt = customer.UpdatedAt
    };
}
