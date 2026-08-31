using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class TenantRepository<T>(AppDbContext context) : ITenantRepository<T> where T : class, ITenantEntity
{
    private readonly AppDbContext _context = context;
    private readonly DbSet<T> _set = context.Set<T>();

    public Task<T?> GetByIdAsync(int studioId, int id, CancellationToken ct = default)
    {
        var keyName = _context.Model.FindEntityType(typeof(T))!.FindPrimaryKey()!.Properties[0].Name;
        var parameter = Expression.Parameter(typeof(T), "x");
        var keyEqual = Expression.Equal(Expression.Property(parameter, keyName), Expression.Constant(id));
        var studioEqual = Expression.Equal(Expression.Property(parameter, nameof(ITenantEntity.StudioId)), Expression.Constant(studioId));
        var predicate = Expression.Lambda<Func<T, bool>>(Expression.AndAlso(keyEqual, studioEqual), parameter);

        return _set.AsNoTracking().FirstOrDefaultAsync(predicate, ct);
    }

    public Task<List<T>> GetAllAsync(int studioId, CancellationToken ct = default) =>
        _set.AsNoTracking().Where(x => x.StudioId == studioId).ToListAsync(ct);

    public async Task AddAsync(T entity, CancellationToken ct = default) =>
        await _set.AddAsync(entity, ct);

    public void Update(T entity) => _set.Update(entity);

    public void Remove(T entity) => _set.Remove(entity);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        _context.SaveChangesAsync(ct);
}
