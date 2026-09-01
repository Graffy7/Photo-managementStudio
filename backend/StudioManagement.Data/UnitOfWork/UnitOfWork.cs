using System.Data;
using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;

namespace StudioManagement.Data.UnitOfWork;

public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken ct = default) => context.SaveChangesAsync(ct);

    public async Task<T> ExecuteInSnapshotAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken ct = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Snapshot, ct);
        var result = await operation(ct);
        await transaction.CommitAsync(ct);
        return result;
    }
}
