using StudioManagement.Business.Common;

namespace StudioManagement.Business.Studios;

public interface IStudioService
{
    Task<StudioCreationResult> CreateAsync(CreateStudioRequestDto request, CancellationToken ct = default);
    Task<PagedResult<StudioDto>> SearchAsync(string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task<StudioDto?> GetByIdAsync(int studioId, CancellationToken ct = default);
    Task<StudioDto?> UpdateAsync(int studioId, UpdateStudioRequestDto request, CancellationToken ct = default);
    Task<StudioDto?> SetActiveAsync(int studioId, bool isActive, CancellationToken ct = default);
    Task<StudioDto?> SetBlockedAsync(int studioId, bool isBlocked, CancellationToken ct = default);
}
