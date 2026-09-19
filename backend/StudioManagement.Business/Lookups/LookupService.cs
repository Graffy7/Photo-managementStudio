using Microsoft.EntityFrameworkCore;
using StudioManagement.Business.Audit;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.Lookups;

public class LookupService<T>(ITenantRepository<T> repository, IAuditService auditService, IUnitOfWork unitOfWork) : ILookupService<T>
    where T : class, ITenantEntity, INamedLookup, new()
{
    private const string Module = "Lookups";
    private static readonly string TypeName = typeof(T).Name;
    public async Task<List<LookupDto>> GetAllAsync(int studioId, CancellationToken ct = default)
    {
        var items = await repository.GetAllAsync(studioId, ct);
        return items
            .OrderBy(i => i.DisplayOrder).ThenBy(i => i.Name)
            .Select(ToDto)
            .ToList();
    }

    public async Task<LookupResult> CreateAsync(int studioId, CreateLookupRequestDto request, CancellationToken ct = default)
    {
        var existing = await repository.GetAllAsync(studioId, ct);
        if (existing.Any(i => string.Equals(i.Name, request.Name, StringComparison.OrdinalIgnoreCase)))
        {
            return LookupResult.Fail(LookupFailureReason.DuplicateName);
        }

        var now = DateTime.UtcNow;
        var entity = new T
        {
            StudioId = studioId,
            Name = request.Name,
            IsActive = true,
            DisplayOrder = request.DisplayOrder ?? 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        await repository.AddAsync(entity, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"{TypeName} lookup created: {entity.Name}", Module, studioId, ct);
        return LookupResult.Success(ToDto(entity));
    }

    public async Task<LookupResult> UpdateAsync(int studioId, int id, UpdateLookupRequestDto request, CancellationToken ct = default)
    {
        var entity = await repository.GetByIdAsync(studioId, id, ct);
        if (entity is null)
        {
            return LookupResult.Fail(LookupFailureReason.NotFound);
        }

        var existing = await repository.GetAllAsync(studioId, ct);
        if (existing.Any(i => repository.GetKey(i) != id && string.Equals(i.Name, request.Name, StringComparison.OrdinalIgnoreCase)))
        {
            return LookupResult.Fail(LookupFailureReason.DuplicateName);
        }

        entity.Name = request.Name;
        entity.IsActive = request.IsActive;
        entity.DisplayOrder = request.DisplayOrder ?? entity.DisplayOrder;
        entity.UpdatedAt = DateTime.UtcNow;

        repository.Update(entity);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync($"{TypeName} lookup updated: {entity.Name}", Module, studioId, ct);
        return LookupResult.Success(ToDto(entity));
    }

    public async Task<LookupDeleteResult> DeleteAsync(int studioId, int id, CancellationToken ct = default)
    {
        var entity = await repository.GetByIdAsync(studioId, id, ct);
        if (entity is null)
        {
            return LookupDeleteResult.NotFound;
        }

        try
        {
            repository.Remove(entity);
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            return LookupDeleteResult.InUse;
        }

        await auditService.LogAsync($"{TypeName} lookup deleted: {entity.Name}", Module, studioId, ct);
        return LookupDeleteResult.Deleted;
    }

    private LookupDto ToDto(T entity) => new()
    {
        Id = repository.GetKey(entity),
        Name = entity.Name,
        IsActive = entity.IsActive,
        DisplayOrder = entity.DisplayOrder
    };
}
