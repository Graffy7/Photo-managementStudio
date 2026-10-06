namespace StudioManagement.Business.Tenant;

public interface ITenantContext
{
    int? CurrentUserId { get; }
    string? CurrentUserType { get; }
    int? CurrentStudioId { get; }
    bool IsSuperAdmin { get; }
}

public static class TenantClaimTypes
{
    public const string UserId = "UserId";
    public const string UserType = "UserType";
    public const string StudioId = "StudioId";
    // When the access token was issued, in Unix milliseconds (JWT "iat" is whole seconds) - lets
    // "sign out everywhere" end exactly the tokens issued before it (SessionRevocationService).
    public const string IssuedAtMs = "IssuedAtMs";
}
