using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface ILeadRepository
{
    Task<Lead?> GetByIdAsync(int studioId, int leadId, CancellationToken ct = default);
    Task<(List<Lead> Items, int TotalCount)> SearchAsync(
        int studioId, string? search, int? leadStatusId, DateTime? createdFrom, DateTime? createdTo, int page, int pageSize, CancellationToken ct = default);
    Task AddAsync(Lead lead, CancellationToken ct = default);
    void Update(Lead lead);
    void Remove(Lead lead);
}
