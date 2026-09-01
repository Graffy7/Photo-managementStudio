namespace StudioManagement.Business.Lookups;

public interface ILookupService<T>
{
    Task<List<LookupDto>> GetAllAsync(int studioId, CancellationToken ct = default);
    Task<LookupResult> CreateAsync(int studioId, CreateLookupRequestDto request, CancellationToken ct = default);
    Task<LookupResult> UpdateAsync(int studioId, int id, UpdateLookupRequestDto request, CancellationToken ct = default);
}
