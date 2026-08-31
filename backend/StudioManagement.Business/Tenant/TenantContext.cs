using Microsoft.AspNetCore.Http;
using StudioManagement.Data.Common;

namespace StudioManagement.Business.Tenant;

public class TenantContext(IHttpContextAccessor httpContextAccessor) : ITenantContext
{
    private readonly System.Security.Claims.ClaimsPrincipal? _user = httpContextAccessor.HttpContext?.User;

    public int? CurrentUserId =>
        int.TryParse(_user?.FindFirst(TenantClaimTypes.UserId)?.Value, out var id) ? id : null;

    public string? CurrentUserType => _user?.FindFirst(TenantClaimTypes.UserType)?.Value;

    public int? CurrentStudioId =>
        int.TryParse(_user?.FindFirst(TenantClaimTypes.StudioId)?.Value, out var studioId) ? studioId : null;

    public bool IsSuperAdmin => CurrentUserType == UserTypes.SuperAdmin;
}
