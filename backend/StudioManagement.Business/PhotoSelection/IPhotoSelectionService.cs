namespace StudioManagement.Business.PhotoSelection;

public enum PhotoSelectionWriteFailureReason
{
    CustomerNotFound,
    EventNotFound
}

public class PhotoSelectionWriteResult
{
    public bool Succeeded { get; private init; }
    public PhotoSelectionWriteFailureReason? FailureReason { get; private init; }
    public PhotoSelectionProjectDto? Project { get; private init; }

    public static PhotoSelectionWriteResult Success(PhotoSelectionProjectDto dto) => new() { Succeeded = true, Project = dto };
    public static PhotoSelectionWriteResult Fail(PhotoSelectionWriteFailureReason reason) => new() { Succeeded = false, FailureReason = reason };
}

public interface IPhotoSelectionService
{
    Task<PhotoSelectionWriteResult> CreateAsync(int studioId, CreatePhotoSelectionProjectRequestDto request, CancellationToken ct = default);
    Task<List<PhotoSelectionProjectDto>> SearchAsync(int studioId, int? customerId, int? eventId, CancellationToken ct = default);

    // Powers the dedicated "Photo Selection" module's list — every Completed event for this
    // studio, each paired with its selection project's status (or none, if not yet created).
    Task<List<CompletedEventPhotoSelectionDto>> GetCompletedEventsAsync(int studioId, CancellationToken ct = default);
    Task<PhotoSelectionProjectDto?> GetByIdAsync(int studioId, int projectId, CancellationToken ct = default);

    Task<GenerateLinkResultDto?> GenerateLinkAsync(int studioId, int projectId, GenerateLinkRequestDto request, CancellationToken ct = default);
    Task<bool?> RevokeLinkAsync(int studioId, int projectId, CancellationToken ct = default);
    Task<bool?> ReopenAsync(int studioId, int projectId, CancellationToken ct = default);

    Task<PhotoProcessingJobDto?> StartProcessingAsync(int studioId, int projectId, CancellationToken ct = default);
    Task<PhotoProcessingJobDto?> GetProcessingJobAsync(int studioId, int projectId, int jobId, CancellationToken ct = default);

    Task<List<PhotoActivityDto>> GetHistoryAsync(int studioId, int projectId, CancellationToken ct = default);
    Task<byte[]?> GetReportCsvAsync(int studioId, int projectId, CancellationToken ct = default);

    // Public/token-authorized side — every public action calls these two first: resolve the raw
    // URL token to a project id (validating hash + IsActive + expiry), then check the PIN if one
    // is configured. Neither ever takes studioId; the token/PIN together *are* the authorization.
    Task<int?> ResolveProjectIdAsync(string rawToken, CancellationToken ct = default);
    Task<bool> ValidateAccessAsync(int projectId, string? suppliedPin, CancellationToken ct = default);

    Task<PublicProjectSummaryDto?> GetPublicSummaryAsync(int projectId, CancellationToken ct = default);
    Task RecordFirstOpenAsync(int projectId, CancellationToken ct = default);
    Task<SubmitResultDto?> SubmitAsync(int projectId, CancellationToken ct = default);
}
