using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Entities;

namespace StudioManagement.Business.Auth;

public class JwtTokenService(IConfiguration configuration) : IJwtTokenService
{
    public (string Token, DateTime ExpiresAtUtc) GenerateToken(User user)
    {
        var key = configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured. Set it via `dotnet user-secrets` (dev) or an environment variable (production).");
        var issuer = configuration["Jwt:Issuer"];
        var audience = configuration["Jwt:Audience"];
        var expiryMinutes = configuration.GetValue<int?>("Jwt:AccessTokenExpiryMinutes") ?? 15;

        var claims = new List<Claim>
        {
            new(TenantClaimTypes.UserId, user.UserId.ToString()),
            new(TenantClaimTypes.UserType, user.UserType),
            new(ClaimTypes.Role, user.UserType),
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (user.StudioId is not null)
        {
            claims.Add(new Claim(TenantClaimTypes.StudioId, user.StudioId.Value.ToString()));
        }

        var expiresAtUtc = DateTime.UtcNow.AddMinutes(expiryMinutes);
        var signingCredentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: signingCredentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAtUtc);
    }
}
