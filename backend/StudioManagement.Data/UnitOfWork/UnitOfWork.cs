using System.Data;
using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;

namespace StudioManagement.Data.UnitOfWork;

public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken ct = default) => context.SaveChangesAsync(ct);

    public async Task<T> ExecuteInSnapshotAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken ct = default)
    {
        // Held open across the transaction so the reset below runs on this same connection.
        await context.Database.OpenConnectionAsync(ct);
        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Snapshot, ct);
            var result = await operation(ct);
            await transaction.CommitAsync(ct);
            return result;
        }
        finally
        {
            // SQL Server keeps a session's isolation level when the connection goes back to the pool,
            // so the next request that borrowed it (e.g. a plain save) silently ran in SNAPSHOT and
            // failed with "update conflict" when two saves met. Put the connection back as we found it.
            await ResetIsolationLevelAsync();
            await context.Database.CloseConnectionAsync();
        }
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken ct = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        var result = await operation(ct);
        await transaction.CommitAsync(ct);
        return result;
    }

    public Task AcquireLockAsync(string resource, CancellationToken ct = default) =>
        context.Database.AcquireAsync(resource, ct);

    private async Task ResetIsolationLevelAsync()
    {
        try
        {
            await context.Database.ExecuteSqlRawAsync("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        }
        catch (Exception)
        {
            // A broken connection is discarded by the pool anyway; never hide the original error.
        }
    }
}
