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

    public async Task<PagedResult<CustomerDto>> SearchAsync(int studioId, string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize is < 1 or > 100 ? 20 : pageSize;

        var (items, totalCount) = await customerRepository.SearchAsync(studioId, search, isActive, page, pageSize, ct);
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

        await customerRepository.AddAsync(customer, ct);
        await unitOfWork.SaveChangesAsync(ct);
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

        customer.FullName = request.FullName;
        customer.MobileNumber = request.MobileNumber;
        customer.Email = request.Email;
        customer.Address = request.Address;
        customer.Notes = request.Notes;
        customer.UpdatedAt = DateTime.UtcNow;

        customerRepository.Update(customer);
        await unitOfWork.SaveChangesAsync(ct);
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
                Notes = e.Notes
            };
        }).ToList();
    }

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
