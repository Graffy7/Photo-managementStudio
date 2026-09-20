using StudioManagement.Data.Common;
using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class UserRepository(AppDbContext context) : Repository<User>(context), IUserRepository
{
    public Task<User?> FindByEmailAsync(string email, CancellationToken ct = default) =>
        Set.Include(u => u.Studio).FirstOrDefaultAsync(u => u.Email == email, ct);


    public Task<User?> GetStudioOwnerAsync(int studioId, CancellationToken ct = default) =>
        Set.Where(u => u.StudioId == studioId && u.UserType == UserTypes.StudioOwner)
            .OrderBy(u => u.UserId)
            .FirstOrDefaultAsync(ct);

    public Task<List<User>> GetStudioOwnersAsync(IEnumerable<int> studioIds, CancellationToken ct = default) =>
        Set.AsNoTracking()
            .Where(u => u.StudioId != null && studioIds.Contains(u.StudioId.Value) && u.UserType == UserTypes.StudioOwner)
            .ToListAsync(ct);
    public Task<List<User>> GetByIdsAsync(IEnumerable<int> ids, CancellationToken ct = default) =>
        Set.AsNoTracking().Where(u => ids.Contains(u.UserId)).ToListAsync(ct);

    public Task<User?> GetByIdWithStudioAsync(int userId, CancellationToken ct = default) =>
        Set.Include(u => u.Studio).FirstOrDefaultAsync(u => u.UserId == userId, ct);
}
