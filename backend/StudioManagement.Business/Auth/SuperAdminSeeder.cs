using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.Auth;

public class SuperAdminSeeder(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IConfiguration configuration,
    ILogger<SuperAdminSeeder> logger)
{
    public async Task SeedAsync(CancellationToken ct = default)
    {
        var email = configuration["Bootstrap:SuperAdminEmail"];
        var password = configuration["Bootstrap:SuperAdminPassword"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "Bootstrap:SuperAdminEmail / Bootstrap:SuperAdminPassword are not configured — skipping Super Admin seed. " +
                "Set them with `dotnet user-secrets set` to bootstrap the first login.");
            return;
        }

        var existing = await userRepository.FindByEmailAsync(email, ct);
        if (existing is not null)
        {
            return;
        }

        var admin = new User
        {
            FullName = "Platform Super Admin",
            Email = email,
            PasswordHash = passwordHasher.Hash(password),
            UserType = UserTypes.SuperAdmin,
            StudioId = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await userRepository.AddAsync(admin, ct);
        await userRepository.SaveChangesAsync(ct);
        logger.LogInformation("Seeded Super Admin account for {Email}", email);
    }
}
