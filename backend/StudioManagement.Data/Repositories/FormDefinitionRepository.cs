using Microsoft.EntityFrameworkCore;
using StudioManagement.Data.Context;
using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public class FormDefinitionRepository(AppDbContext context) : Repository<FormDefinition>(context), IFormDefinitionRepository
{
    public Task<FormDefinition?> FindByCodeAsync(int studioId, string formCode, CancellationToken ct = default) =>
        Set.Include(f => f.FormFields).ThenInclude(field => field.Options)
            .FirstOrDefaultAsync(f => f.StudioId == studioId && f.FormCode == formCode, ct);
}
