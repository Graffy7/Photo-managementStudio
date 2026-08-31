using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface ITenantRepository<T> where T : class, ITenantEntity
{
    Task<T?> GetByIdAsync(int studioId, int id, CancellationToken ct = default);
    Task<List<T>> GetAllAsync(int studioId, CancellationToken ct = default);
    Task AddAsync(T entity, CancellationToken ct = default);
    void Update(T entity);
    void Remove(T entity);
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
