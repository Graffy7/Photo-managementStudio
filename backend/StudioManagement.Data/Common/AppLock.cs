using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace StudioManagement.Data.Common;

// A named lock held by SQL Server until the current transaction ends (sp_getapplock). Used where two
// devices doing the same thing at the same moment must take turns - creating the customer for one
// mobile number, picking the next quotation number - without any schema change. It lives in the
// database, so it also works when several API servers share one database.
public static class AppLock
{
    // SQL error number raised when the lock isn't granted in time; mapped to a friendly 409.
    public const int TimeoutErrorNumber = 50001;

    public static Task AcquireAsync(this DatabaseFacade database, string resource, CancellationToken ct = default, int timeoutMs = 10_000) =>
        database.ExecuteSqlInterpolatedAsync($@"
DECLARE @result int;
EXEC @result = sp_getapplock @Resource = {resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = {timeoutMs};
IF @result < 0 THROW 50001, 'Busy: the same record is being saved by another request.', 1;", ct);
}
