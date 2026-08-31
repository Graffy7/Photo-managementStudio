using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class PasswordResetTokenRepository(AppDbContext context) : Repository<PasswordResetToken>(context), IPasswordResetTokenRepository
{
    public Task<PasswordResetToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        Set.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public Task<List<PasswordResetToken>> GetActiveByUserIdAsync(int userId, CancellationToken ct = default) =>
        Set.Where(t => t.UserId == userId && t.UsedAt == null && t.ExpiresAt > DateTime.UtcNow).ToListAsync(ct);
}
