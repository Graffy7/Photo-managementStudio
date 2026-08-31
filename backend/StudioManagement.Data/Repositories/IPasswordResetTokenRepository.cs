using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IPasswordResetTokenRepository : IRepository<PasswordResetToken>
{
    Task<PasswordResetToken?> FindByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task<List<PasswordResetToken>> GetActiveByUserIdAsync(int userId, CancellationToken ct = default);
}
