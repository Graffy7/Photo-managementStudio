using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Text;
using StudioManagement.Business.Audit;
using StudioManagement.Business.Auth;
using StudioManagement.Business.Notifications;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public class PhotoSelectionService(
    IPhotoSelectionProjectRepository projectRepository,
    IPhotoRepository photoRepository,
    IPhotoSelectionActivityRepository activityRepository,
    IPhotoProcessingJobRepository jobRepository,
    ICustomerRepository customerRepository,
    IEventRepository eventRepository,
    IPasswordHasher passwordHasher,
    IAuditService auditService,
    INotificationService notificationService,
    IServiceScopeFactory scopeFactory,
    ILogger<PhotoSelectionService> logger,
    IUnitOfWork unitOfWork) : IPhotoSelectionService
{
    private const string Module = "PhotoSelection";

    public async Task<PhotoSelectionWriteResult> CreateAsync(int studioId, CreatePhotoSelectionProjectRequestDto request, CancellationToken ct = default)
    {
        var customer = await customerRepository.GetByIdAsync(studioId, request.CustomerId, ct);
        if (customer is null)
        {
            return PhotoSelectionWriteResult.Fail(PhotoSelectionWriteFailureReason.CustomerNotFound);
        }

        if (request.EventId is not null)
        {
            var evt = await eventRepository.GetByIdAsync(studioId, request.EventId.Value, ct);
            if (evt is null)
            {
                return PhotoSelectionWriteResult.Fail(PhotoSelectionWriteFailureReason.EventNotFound);
            }
        }

        var now = DateTime.UtcNow;
        var project = new PhotoSelectionProject
        {
            StudioId = studioId,
            CustomerId = request.CustomerId,
            EventId = request.EventId,
            Name = request.Name,
            SourceFolder = request.SourceFolder,
            DestinationRootFolder = request.DestinationRootFolder,
            Status = PhotoSelectionStatuses.Draft,
            SelectionLimitTotal = request.SelectionLimitTotal,
            SelectionLimitNormal = request.SelectionLimitNormal,
            SelectionLimitBig = request.SelectionLimitBig,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        await projectRepository.AddAsync(project, ct);
        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Photo selection project created", Module, studioId, ct);

        var created = await projectRepository.GetByIdAsync(studioId, project.PhotoSelectionProjectId, ct);
        return PhotoSelectionWriteResult.Success(await MapToDtoAsync(created!, ct));
    }

    public async Task<List<PhotoSelectionProjectDto>> SearchAsync(int studioId, int? customerId, int? eventId, CancellationToken ct = default)
    {
        var projects = await projectRepository.SearchAsync(studioId, customerId, eventId, ct);
        var results = new List<PhotoSelectionProjectDto>();
        foreach (var project in projects)
        {
            results.Add(await MapToDtoAsync(project, ct));
        }
        return results;
    }

    public async Task<List<CompletedEventPhotoSelectionDto>> GetCompletedEventsAsync(int studioId, CancellationToken ct = default)
    {
        var (events, _) = await eventRepository.SearchAsync(studioId, null, EventStatuses.Completed, null, 1, 500, ct);
        var eventIds = events.Select(e => e.EventId).ToList();

        // One extra query total, not one per event — the whole point of this dedicated lookup.
        var projects = await projectRepository.GetByEventIdsAsync(studioId, eventIds, ct);
        var latestByEvent = projects
            .GroupBy(p => p.EventId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.CreatedAt).First());

        return events.Select(e =>
        {
            latestByEvent.TryGetValue(e.EventId, out var project);
            return new CompletedEventPhotoSelectionDto
            {
                EventId = e.EventId,
                EventDate = e.EventDate,
                Venue = e.Venue,
                CustomerId = e.CustomerId,
                CustomerName = e.Customer.FullName,
                PhotoSelectionProjectId = project?.PhotoSelectionProjectId,
                Status = project?.Status
            };
        }).ToList();
    }

    public async Task<PhotoSelectionProjectDto?> GetByIdAsync(int studioId, int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        return project is null ? null : await MapToDtoAsync(project, ct);
    }

    public async Task<GenerateLinkResultDto?> GenerateLinkAsync(int studioId, int projectId, GenerateLinkRequestDto request, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        if (project is null)
        {
            return null;
        }

        var rawToken = TokenHasher.GenerateRawToken();
        var now = DateTime.UtcNow;

        project.AccessTokenHash = TokenHasher.Hash(rawToken);
        project.TokenExpiresAt = request.ExpiresInDays is > 0 ? now.AddDays(request.ExpiresInDays.Value) : null;
        project.PinHash = string.IsNullOrWhiteSpace(request.Pin) ? null : passwordHasher.Hash(request.Pin);
        project.IsActive = true;
        project.LinkGeneratedAt = now;
        if (project.Status == PhotoSelectionStatuses.Draft)
        {
            project.Status = PhotoSelectionStatuses.LinkGenerated;
        }
        project.UpdatedAt = now;
        projectRepository.Update(project);

        await activityRepository.AddAsync(new PhotoSelectionActivity
        {
            PhotoSelectionProjectId = projectId,
            Action = "LinkGenerated",
            CreatedAt = now
        }, ct);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Photo selection link generated", Module, studioId, ct);

        return new GenerateLinkResultDto { Token = rawToken, TokenExpiresAt = project.TokenExpiresAt };
    }

    public async Task<bool?> RevokeLinkAsync(int studioId, int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        if (project is null)
        {
            return null;
        }

        project.IsActive = false;
        project.UpdatedAt = DateTime.UtcNow;
        projectRepository.Update(project);

        await activityRepository.AddAsync(new PhotoSelectionActivity
        {
            PhotoSelectionProjectId = projectId,
            Action = "LinkRevoked",
            CreatedAt = DateTime.UtcNow
        }, ct);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Photo selection link revoked", Module, studioId, ct);
        return true;
    }

    public async Task<bool?> ReopenAsync(int studioId, int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        if (project is null)
        {
            return null;
        }
        if (project.Status != PhotoSelectionStatuses.Submitted)
        {
            return false;
        }

        var now = DateTime.UtcNow;
        project.Status = PhotoSelectionStatuses.Reopened;
        project.ReopenedAt = now;
        project.UpdatedAt = now;
        projectRepository.Update(project);

        await activityRepository.AddAsync(new PhotoSelectionActivity
        {
            PhotoSelectionProjectId = projectId,
            Action = "Reopened",
            CreatedAt = now
        }, ct);

        await unitOfWork.SaveChangesAsync(ct);
        await auditService.LogAsync("Photo selection reopened", Module, studioId, ct);
        return true;
    }

    public async Task<PhotoProcessingJobDto?> StartProcessingAsync(int studioId, int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        if (project is null)
        {
            return null;
        }

        var selected = await photoRepository.GetSelectedAsync(projectId, ct);
        var job = new PhotoProcessingJob
        {
            PhotoSelectionProjectId = projectId,
            Status = PhotoProcessingJobStatuses.Pending,
            TotalCount = selected.Count,
            CreatedAt = DateTime.UtcNow
        };
        await jobRepository.AddAsync(job, ct);
        await unitOfWork.SaveChangesAsync(ct);

        // Detached from this request's lifetime/scope on purpose — a large processing run must
        // outlive the HTTP request that kicked it off. The frontend polls GetProcessingJobAsync
        // for progress instead of waiting on this call.
        var jobId = job.PhotoProcessingJobId;
        _ = Task.Run(() => RunProcessingAsync(projectId, jobId), CancellationToken.None);

        return MapJobToDto(job, []);
    }

    private async Task RunProcessingAsync(int projectId, int jobId)
    {
        using var scope = scopeFactory.CreateScope();
        var jobRepo = scope.ServiceProvider.GetRequiredService<IPhotoProcessingJobRepository>();
        var projectRepo = scope.ServiceProvider.GetRequiredService<IPhotoSelectionProjectRepository>();
        var photoRepo = scope.ServiceProvider.GetRequiredService<IPhotoRepository>();
        var processor = scope.ServiceProvider.GetRequiredService<ILocalPhotoProcessor>();
        var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        try
        {
            var job = await jobRepo.GetByIdAsync(projectId, jobId, CancellationToken.None);
            var project = await projectRepo.GetByIdAsync(projectId, CancellationToken.None);
            if (job is null || project is null)
            {
                return;
            }

            job.Status = PhotoProcessingJobStatuses.Running;
            job.StartedAt = DateTime.UtcNow;
            jobRepo.Update(job);
            await uow.SaveChangesAsync(CancellationToken.None);

            var selected = await photoRepo.GetSelectedAsync(projectId, CancellationToken.None);
            var result = await processor.ProcessAsync(project, selected, CancellationToken.None);

            var now = DateTime.UtcNow;
            job.CompletedCount = result.Completed;
            job.MissingCount = result.Missing;
            job.FailedCount = result.Failed;
            job.Status = result.Missing > 0 || result.Failed > 0
                ? PhotoProcessingJobStatuses.CompletedWithErrors
                : PhotoProcessingJobStatuses.Completed;
            job.CompletedAt = now;
            jobRepo.Update(job);

            await jobRepo.AddItemsAsync(result.Items.Select(i => new PhotoProcessingJobItem
            {
                PhotoProcessingJobId = jobId,
                PhotoId = i.PhotoId,
                Result = i.Result,
                ErrorMessage = i.ErrorMessage,
                CreatedAt = now
            }), CancellationToken.None);

            project.Status = PhotoSelectionStatuses.Processed;
            project.ProcessedAt = now;
            project.UpdatedAt = now;
            projectRepo.Update(project);

            await uow.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Photo processing job {JobId} for project {ProjectId} failed", jobId, projectId);
            try
            {
                var job = await jobRepo.GetByIdAsync(projectId, jobId, CancellationToken.None);
                if (job is not null)
                {
                    job.Status = PhotoProcessingJobStatuses.Failed;
                    job.CompletedAt = DateTime.UtcNow;
                    jobRepo.Update(job);
                    await uow.SaveChangesAsync(CancellationToken.None);
                }
            }
            catch (Exception innerEx)
            {
                logger.LogError(innerEx, "Failed to mark photo processing job {JobId} as failed", jobId);
            }
        }
    }

    public async Task<PhotoProcessingJobDto?> GetProcessingJobAsync(int studioId, int projectId, int jobId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        if (project is null)
        {
            return null;
        }

        var job = await jobRepository.GetByIdAsync(projectId, jobId, ct);
        if (job is null)
        {
            return null;
        }

        var items = job.Items.Select(i => new PhotoProcessingJobItemDto
        {
            PhotoNumber = i.Photo.PhotoNumber,
            OriginalFileName = i.Photo.OriginalFileName,
            Result = i.Result,
            ErrorMessage = i.ErrorMessage
        }).ToList();

        return MapJobToDto(job, items);
    }

    public async Task<List<PhotoActivityDto>> GetHistoryAsync(int studioId, int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        if (project is null)
        {
            return [];
        }

        var activities = await activityRepository.SearchAsync(projectId, ct);
        return activities.Select(a => new PhotoActivityDto
        {
            Action = a.Action,
            PhotoNumber = a.Photo?.PhotoNumber,
            OldSelectionType = a.OldSelectionType,
            NewSelectionType = a.NewSelectionType,
            CreatedAt = a.CreatedAt
        }).ToList();
    }

    public async Task<byte[]?> GetReportCsvAsync(int studioId, int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct);
        if (project is null)
        {
            return null;
        }

        var selected = await photoRepository.GetSelectedAsync(projectId, ct);
        var sb = new StringBuilder();
        sb.AppendLine("PhotoNumber,OriginalFileName,SelectionType,SelectedAt");
        foreach (var photo in selected.OrderBy(p => p.PhotoNumber))
        {
            sb.AppendLine($"{photo.PhotoNumber},{EscapeCsv(photo.OriginalFileName)},{photo.SelectionType},{photo.SelectedAt:yyyy-MM-dd HH:mm}");
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string EscapeCsv(string value) =>
        value.Contains(',') || value.Contains('"') ? $"\"{value.Replace("\"", "\"\"")}\"" : value;

    public async Task<int?> ResolveProjectIdAsync(string rawToken, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return null;
        }

        var project = await projectRepository.GetByTokenHashAsync(TokenHasher.Hash(rawToken), ct);
        if (project is null || !project.IsActive)
        {
            return null;
        }
        if (project.TokenExpiresAt is not null && project.TokenExpiresAt <= DateTime.UtcNow)
        {
            return null;
        }

        return project.PhotoSelectionProjectId;
    }

    // Wrong-PIN guesses per project. The gallery endpoints re-check the PIN on every call and are
    // rate-limited generously, so guessing is bounded here instead: after MaxPinFailures wrong PINs
    // the project rejects every attempt (even a correct PIN) until the window passes. A request with
    // no PIN at all (the page's first call) isn't a guess and isn't counted.
    private const int MaxPinFailures = 10;
    private static readonly TimeSpan PinLockWindow = TimeSpan.FromMinutes(10);
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, (int Failures, DateTime WindowStart)> PinFailures = new();

    public async Task<bool> ValidateAccessAsync(int projectId, string? suppliedPin, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(projectId, ct);
        if (project is null)
        {
            return false;
        }
        if (string.IsNullOrWhiteSpace(project.PinHash))
        {
            return true;
        }
        if (string.IsNullOrWhiteSpace(suppliedPin))
        {
            return false;
        }

        var now = DateTime.UtcNow;
        if (PinFailures.TryGetValue(projectId, out var state) && now - state.WindowStart < PinLockWindow && state.Failures >= MaxPinFailures)
        {
            return false;
        }

        if (passwordHasher.Verify(suppliedPin, project.PinHash))
        {
            PinFailures.TryRemove(projectId, out _);
            return true;
        }

        PinFailures.AddOrUpdate(
            projectId,
            _ => (1, now),
            (_, existing) => now - existing.WindowStart >= PinLockWindow ? (1, now) : (existing.Failures + 1, existing.WindowStart));
        return false;
    }

    public async Task<PublicProjectSummaryDto?> GetPublicSummaryAsync(int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(projectId, ct);
        if (project is null)
        {
            return null;
        }

        var (total, normal, big) = await photoRepository.GetCountsAsync(projectId, ct);
        return new PublicProjectSummaryDto
        {
            ProjectName = project.Name,
            Status = project.Status,
            RequiresPin = !string.IsNullOrWhiteSpace(project.PinHash),
            IsSubmitted = project.Status == PhotoSelectionStatuses.Submitted,
            SubmittedAt = project.SubmittedAt,
            SelectionLimitTotal = project.SelectionLimitTotal,
            SelectionLimitNormal = project.SelectionLimitNormal,
            SelectionLimitBig = project.SelectionLimitBig,
            TotalPhotos = total,
            SelectedCount = normal + big,
            NormalCount = normal,
            BigCount = big
        };
    }

    public async Task RecordFirstOpenAsync(int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(projectId, ct);
        if (project is null || project.FirstOpenedAt is not null)
        {
            return;
        }

        project.FirstOpenedAt = DateTime.UtcNow;
        project.UpdatedAt = DateTime.UtcNow;
        projectRepository.Update(project);

        await activityRepository.AddAsync(new PhotoSelectionActivity
        {
            PhotoSelectionProjectId = projectId,
            Action = "LinkOpened",
            CreatedAt = DateTime.UtcNow
        }, ct);

        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<SubmitResultDto?> SubmitAsync(int projectId, CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(projectId, ct);
        if (project is null)
        {
            return null;
        }

        var (_, normal, big) = await photoRepository.GetCountsAsync(projectId, ct);

        if (project.Status != PhotoSelectionStatuses.Submitted)
        {
            var wasReopened = project.Status == PhotoSelectionStatuses.Reopened;
            var now = DateTime.UtcNow;
            project.Status = PhotoSelectionStatuses.Submitted;
            project.SubmittedAt = now;
            project.UpdatedAt = now;
            projectRepository.Update(project);

            await activityRepository.AddAsync(new PhotoSelectionActivity
            {
                PhotoSelectionProjectId = projectId,
                Action = wasReopened ? "Resubmitted" : "Submitted",
                CreatedAt = now
            }, ct);

            await unitOfWork.SaveChangesAsync(ct);
            await auditService.LogAsync("Photo selection submitted", Module, project.StudioId, ct);

            await notificationService.NotifyAsync(
                project.StudioId,
                "Photo Selection Completed",
                $"{project.Customer.FullName} submitted their selection for \"{project.Name}\" — {normal + big} photos (Normal: {normal}, Big: {big}).",
                NotificationTypes.PhotoSelectionSubmitted,
                ct);
        }

        return new SubmitResultDto { SubmittedAt = project.SubmittedAt!.Value, TotalSelected = normal + big, Normal = normal, Big = big };
    }

    private async Task<PhotoSelectionProjectDto> MapToDtoAsync(PhotoSelectionProject project, CancellationToken ct)
    {
        var (total, normal, big) = await photoRepository.GetCountsAsync(project.PhotoSelectionProjectId, ct);
        return new PhotoSelectionProjectDto
        {
            PhotoSelectionProjectId = project.PhotoSelectionProjectId,
            CustomerId = project.CustomerId,
            CustomerName = project.Customer.FullName,
            EventId = project.EventId,
            EventVenue = project.Event?.Venue,
            Name = project.Name,
            SourceFolder = project.SourceFolder,
            DestinationRootFolder = project.DestinationRootFolder,
            Status = project.Status,
            SelectionLimitTotal = project.SelectionLimitTotal,
            SelectionLimitNormal = project.SelectionLimitNormal,
            SelectionLimitBig = project.SelectionLimitBig,
            IsActive = project.IsActive,
            HasLink = !string.IsNullOrWhiteSpace(project.AccessTokenHash),
            HasPin = !string.IsNullOrWhiteSpace(project.PinHash),
            TokenExpiresAt = project.TokenExpiresAt,
            LinkGeneratedAt = project.LinkGeneratedAt,
            FirstOpenedAt = project.FirstOpenedAt,
            SelectionStartedAt = project.SelectionStartedAt,
            SubmittedAt = project.SubmittedAt,
            ReopenedAt = project.ReopenedAt,
            ProcessedAt = project.ProcessedAt,
            CreatedAt = project.CreatedAt,
            TotalPhotos = total,
            SelectedCount = normal + big,
            NormalCount = normal,
            BigCount = big
        };
    }

    private static PhotoProcessingJobDto MapJobToDto(PhotoProcessingJob job, List<PhotoProcessingJobItemDto> items) => new()
    {
        PhotoProcessingJobId = job.PhotoProcessingJobId,
        Status = job.Status,
        TotalCount = job.TotalCount,
        CompletedCount = job.CompletedCount,
        MissingCount = job.MissingCount,
        FailedCount = job.FailedCount,
        StartedAt = job.StartedAt,
        CompletedAt = job.CompletedAt,
        Items = items
    };
}
