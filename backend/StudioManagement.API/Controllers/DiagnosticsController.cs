using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;
using StudioManagement.Data.Context;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = UserTypes.SuperAdmin)]
public class DiagnosticsController(AppDbContext db, ITenantContext tenantContext) : ControllerBase
{
    [HttpGet("health")]
    public async Task<IActionResult> Health(CancellationToken ct)
    {
        var canConnect = await db.Database.CanConnectAsync(ct);
        var pendingMigrations = await db.Database.GetPendingMigrationsAsync(ct);

        return Ok(new
        {
            status = canConnect ? "healthy" : "unreachable",
            database = db.Database.GetDbConnection().Database,
            pendingMigrations = pendingMigrations.ToArray()
        });
    }

    [HttpGet("tenant-context")]
    public IActionResult TenantContextSnapshot()
    {
        return Ok(new
        {
            currentUserId = tenantContext.CurrentUserId,
            currentUserType = tenantContext.CurrentUserType,
            currentStudioId = tenantContext.CurrentStudioId,
            isSuperAdmin = tenantContext.IsSuperAdmin
        });
    }
}
