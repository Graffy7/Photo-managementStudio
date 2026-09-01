using StudioManagement.Data.Entities;

namespace StudioManagement.Data.Repositories;

public interface IFormDefinitionRepository : IRepository<FormDefinition>
{
    Task<FormDefinition?> FindByCodeAsync(int studioId, string formCode, CancellationToken ct = default);
}
