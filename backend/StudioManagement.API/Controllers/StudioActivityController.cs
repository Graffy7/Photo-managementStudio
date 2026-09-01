using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

// A studio-owner-scoped view over the same audit trail the Super Admin's /api/audit-logs already
// exposes across every studio — this just pins studioId to the caller's own tenant rather than
// taking it from the client, and reuses IAuditService entirely (no new logging logic needed).
[ApiController]
[Route("api/studio-activity")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class StudioActivityController(IAuditService auditService, ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await auditService.SearchAsync(StudioId, page, pageSize, ct));
}
