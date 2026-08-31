using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IUserRepository : IRepository<User>
{
    Task<User?> FindByEmailAsync(string email, CancellationToken ct = default);
}
