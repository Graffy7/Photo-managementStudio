using StudioManagement.Business.Common;

namespace StudioManagement.Business.Studios;

public interface IStudioService
{
    Task<StudioCreationResult> CreateAsync(CreateStudioRequestDto request, CancellationToken ct = default);
    Task<PagedResult<StudioDto>> SearchAsync(string? search, bool? isActive, int page, int pageSize, CancellationToken ct = default);
    Task<StudioDto?> GetByIdAsync(int studioId, CancellationToken ct = default);
    Task<StudioUpdateResult> UpdateAsync(int studioId, UpdateStudioRequestDto request, CancellationToken ct = default);

    // Sets a NEW password for the studio owner. The existing one cannot be read back — it is stored
    // only as a one-way hash — so this replaces it outright.
    Task<PasswordResetResult> ResetOwnerPasswordAsync(int studioId, string newPassword, CancellationToken ct = default);
    Task<StudioDto?> UploadLogoAsync(int studioId, Stream content, string fileName, CancellationToken ct = default);
    Task<StudioDto?> RemoveLogoAsync(int studioId, CancellationToken ct = default);
    Task<StudioDto?> SetActiveAsync(int studioId, bool isActive, CancellationToken ct = default);
    Task<StudioDto?> SetBlockedAsync(int studioId, bool isBlocked, CancellationToken ct = default);
}
