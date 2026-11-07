using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

// Where an enquiry ended up: turned into a customer, still open, or its event date went by without
// it being converted.
public enum LeadOutcome
{
    Converted,
    NotConverted,
    EventOver,
}

public interface ILeadRepository
{
    Task<Lead?> GetByIdAsync(int studioId, int leadId, CancellationToken ct = default);
    // outcome filters by LeadOutcome, judged against `today` (the studio's calendar day).
    Task<(List<Lead> Items, int TotalCount)> SearchAsync(
        int studioId, string? search, int? leadStatusId, DateTime? createdFrom, DateTime? createdTo, int page, int pageSize, CancellationToken ct = default, ListSort? sort = null,
        LeadOutcome? outcome = null, DateTime? today = null);
    Task AddAsync(Lead lead, CancellationToken ct = default);
    void Update(Lead lead);
    void Remove(Lead lead);
}
