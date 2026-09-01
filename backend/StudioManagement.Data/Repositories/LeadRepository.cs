using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class LeadRepository(AppDbContext context) : ILeadRepository
{
    public Task<Lead?> GetByIdAsync(int studioId, int leadId, CancellationToken ct = default) =>
        context.Leads
            .Include(l => l.EventType)
            .Include(l => l.LeadSource)
            .Include(l => l.LeadStatus)
            .FirstOrDefaultAsync(l => l.StudioId == studioId && l.LeadId == leadId, ct);

    public async Task<(List<Lead> Items, int TotalCount)> SearchAsync(int studioId, string? search, int? leadStatusId, int page, int pageSize, CancellationToken ct = default)
    {
        var query = context.Leads
            .AsNoTracking()
            .Include(l => l.EventType)
            .Include(l => l.LeadSource)
            .Include(l => l.LeadStatus)
            .Where(l => l.StudioId == studioId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(l => l.FullName.Contains(term) || l.MobileNumber.Contains(term));
        }

        if (leadStatusId is not null)
        {
            query = query.Where(l => l.LeadStatusId == leadStatusId);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task AddAsync(Lead lead, CancellationToken ct = default) =>
        await context.Leads.AddAsync(lead, ct);

    public void Update(Lead lead) => context.Leads.Update(lead);

    public void Remove(Lead lead) => context.Leads.Remove(lead);
}
