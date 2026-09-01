using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class WorkerRepository(AppDbContext context) : IWorkerRepository
{
    public Task<Worker?> GetByIdAsync(int studioId, int workerId, CancellationToken ct = default) =>
        context.Workers
            .Include(w => w.WorkerType)
            .FirstOrDefaultAsync(w => w.StudioId == studioId && w.WorkerId == workerId, ct);

    public async Task<(List<Worker> Items, int TotalCount)> SearchAsync(int studioId, string? search, int? workerTypeId, bool? isActive, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Workers
            .AsNoTracking()
            .Include(w => w.WorkerType)
            .Where(w => w.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(w => w.FullName.Contains(term) || (w.MobileNumber != null && w.MobileNumber.Contains(term)));
        }

        if (workerTypeId is not null)
        {
            query = query.Where(w => w.WorkerTypeId == workerTypeId);
        }

        if (isActive is not null)
        {
            query = query.Where(w => w.IsActive == isActive);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task AddAsync(Worker worker, CancellationToken ct = default) =>
        await context.Workers.AddAsync(worker, ct);

    public void Update(Worker worker) => context.Workers.Update(worker);
}
