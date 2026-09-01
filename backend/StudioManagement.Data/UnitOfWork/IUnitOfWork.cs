namespace StudioManagement.Data.UnitOfWork;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);

    /// Runs a read-only operation inside a SNAPSHOT-isolation transaction, so every query it
    /// issues sees one consistent point-in-time view of the database — even across several
    /// sequential round trips — instead of each one independently seeing whatever the default
    /// read-committed-snapshot behavior has most recently committed.
    Task<T> ExecuteInSnapshotAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken ct = default);
}
