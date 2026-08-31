using StudioManagement.Data.Entities;

namespace StudioManagement.Business.Auth;

public interface IJwtTokenService
{
    (string Token, DateTime ExpiresAtUtc) GenerateToken(User user);
}
