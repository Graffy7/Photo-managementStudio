using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;

namespace StudioManagement.Data.Repositories;

public class Repository<T>(AppDbContext context) : IRepository<T> where T : class
{
    protected readonly AppDbContext Context = context;
    protected readonly DbSet<T> Set = context.Set<T>();

    public Task<T?> GetByIdAsync(int id, CancellationToken ct = default) =>
        Set.FindAsync([id], ct).AsTask();

    public Task<List<T>> GetAllAsync(CancellationToken ct = default) =>
        Set.AsNoTracking().ToListAsync(ct);

    public async Task AddAsync(T entity, CancellationToken ct = default) =>
        await Set.AddAsync(entity, ct);

    public void Update(T entity) => Set.Update(entity);

    public void Remove(T entity) => Set.Remove(entity);

    public Task<int> SaveChangesAsync(CancellationToken ct = default) =>
        Context.SaveChangesAsync(ct);
}
