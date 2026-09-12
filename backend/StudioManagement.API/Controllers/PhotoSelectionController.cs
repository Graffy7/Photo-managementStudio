using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.PhotoSelection;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;

namespace StudioManagement.API.Controllers;

[ApiController]
[Route("api/photo-selection")]
[Authorize(Roles = UserTypes.StudioOwner)]
public class PhotoSelectionController(
    IPhotoSelectionService photoSelectionService,
    IPhotoService photoService,
    IValidator<CreatePhotoSelectionProjectRequestDto> createValidator,
    IValidator<GenerateLinkRequestDto> generateLinkValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;
    private const long MaxPhotoSizeBytes = 50 * 1024 * 1024;
    private static readonly HashSet<string> AllowedPhotoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/jpg", "image/png", "image/webp"
    };
    private static readonly HashSet<string> BrowsableImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"
    };

    [HttpGet("projects")]
    public async Task<IActionResult> Search([FromQuery] int? customerId, [FromQuery] int? eventId, CancellationToken ct) =>
        Ok(await photoSelectionService.SearchAsync(StudioId, customerId, eventId, ct));

    // Lets the owner pick a "Source folder" by browsing the studio machine's own disk (this
    // backend already runs on that same machine, per the local-processing design — see
    // ILocalPhotoProcessor) instead of typing an absolute path by hand. No path given => drive list.
    [HttpGet("browse-folders")]
    public IActionResult BrowseFolders([FromQuery] string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            // Mirrors what Windows' own "This PC" view opens to — the user's library folders
            // first (where photos are most likely to already live), then the raw drive list.
            var quickAccess = new[]
            {
                ("Desktop", Environment.SpecialFolder.DesktopDirectory),
                ("Documents", Environment.SpecialFolder.MyDocuments),
                ("Pictures", Environment.SpecialFolder.MyPictures),
                ("Videos", Environment.SpecialFolder.MyVideos),
            }
            .Select(f => (f.Item1, Path: Environment.GetFolderPath(f.Item2)))
            .Where(f => !string.IsNullOrEmpty(f.Path) && Directory.Exists(f.Path))
            .Select(f => new FolderBrowseEntryDto { Name = f.Item1, FullPath = f.Path })
            .ToList();

            var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            var downloads = Path.Combine(userProfile, "Downloads");
            if (Directory.Exists(downloads))
            {
                quickAccess.Insert(1, new FolderBrowseEntryDto { Name = "Downloads", FullPath = downloads });
            }

            var drives = DriveInfo.GetDrives()
                .Where(d => d.IsReady)
                .Select(d => new FolderBrowseEntryDto { Name = d.Name, FullPath = d.Name })
                .OrderBy(d => d.Name)
                .ToList();

            return Ok(new FolderBrowseResultDto { CurrentPath = null, ParentPath = null, Folders = [.. quickAccess, .. drives] });
        }

        if (!Directory.Exists(path))
        {
            return BadRequest(new { message = "That folder doesn't exist or isn't accessible." });
        }

        try
        {
            var folders = Directory.GetDirectories(path)
                .Select(p => new FolderBrowseEntryDto { Name = Path.GetFileName(p), FullPath = p })
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Shown for context only (so the owner can visually confirm this is the right
            // folder before selecting it) — files themselves aren't selectable here.
            var files = Directory.GetFiles(path)
                .Select(p => new FolderBrowseFileEntryDto
                {
                    Name = Path.GetFileName(p),
                    FullPath = p,
                    IsImage = BrowsableImageExtensions.Contains(Path.GetExtension(p))
                })
                .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var parent = Directory.GetParent(path)?.FullName;
            return Ok(new FolderBrowseResultDto { CurrentPath = path, ParentPath = parent, Folders = folders, Files = files });
        }
        catch (UnauthorizedAccessException)
        {
            return BadRequest(new { message = "That folder can't be opened (access denied)." });
        }
        catch (IOException)
        {
            return BadRequest(new { message = "That folder can't be opened." });
        }
    }

    // Small resized preview of one image file on the studio machine's disk — powers the thumbnail
    // grid in the "Browse" folder picker. Deliberately not [AllowAnonymous]: unlike imported
    // Photos (served as static files under a random project path), this reads an arbitrary path
    // the owner is currently browsing, so it stays behind the same StudioOwner auth as the rest
    // of this controller.
    [HttpGet("browse-file-preview")]
    public async Task<IActionResult> BrowseFilePreview([FromQuery] string path, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return BadRequest();
        }

        var bytes = await photoService.GetLocalImagePreviewAsync(path, ct);
        return bytes is null ? NotFound() : File(bytes, "image/jpeg");
    }

    [HttpGet("completed-events")]
    public async Task<IActionResult> GetCompletedEvents(CancellationToken ct) =>
        Ok(await photoSelectionService.GetCompletedEventsAsync(StudioId, ct));

    [HttpGet("projects/{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var project = await photoSelectionService.GetByIdAsync(StudioId, id, ct);
        return project is null ? NotFound() : Ok(project);
    }

    [HttpPost("projects")]
    public async Task<IActionResult> Create(CreatePhotoSelectionProjectRequestDto request, CancellationToken ct)
    {
        var validation = await createValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await photoSelectionService.CreateAsync(StudioId, request, ct);
        if (!result.Succeeded)
        {
            return result.FailureReason switch
            {
                PhotoSelectionWriteFailureReason.CustomerNotFound => BadRequest(new { message = "The selected customer could not be found." }),
                PhotoSelectionWriteFailureReason.EventNotFound => BadRequest(new { message = "The selected event could not be found." }),
                _ => BadRequest(new { message = "Invalid request." })
            };
        }
        return Ok(result.Project);
    }

    [HttpGet("projects/{id:int}/photos")]
    public async Task<IActionResult> GetPhotos(int id, [FromQuery] int? after, [FromQuery] int limit, CancellationToken ct)
    {
        var project = await photoSelectionService.GetByIdAsync(StudioId, id, ct);
        if (project is null)
        {
            return NotFound();
        }

        limit = limit is < 1 or > 200 ? 50 : limit;
        return Ok(await photoService.GetPhotosAsync(id, after, limit, ct));
    }

    [HttpPost("projects/{id:int}/photos")]
    [RequestSizeLimit(500 * 1024 * 1024)]
    public async Task<IActionResult> ImportPhotos(int id, List<IFormFile> files, CancellationToken ct)
    {
        var project = await photoSelectionService.GetByIdAsync(StudioId, id, ct);
        if (project is null)
        {
            return NotFound();
        }
        if (files.Count == 0)
        {
            return BadRequest(new { message = "No files were uploaded." });
        }

        foreach (var file in files)
        {
            if (file.Length > MaxPhotoSizeBytes)
            {
                return BadRequest(new { message = $"{file.FileName} is larger than the 50MB limit." });
            }
            if (!AllowedPhotoContentTypes.Contains(file.ContentType))
            {
                return BadRequest(new { message = $"{file.FileName} must be a JPG, PNG, or WEBP image." });
            }
        }

        var streams = new List<Stream>();
        try
        {
            var entries = new List<(Stream Content, string OriginalFileName, string RelativePath)>();
            foreach (var file in files)
            {
                var stream = file.OpenReadStream();
                streams.Add(stream);
                entries.Add((stream, file.FileName, file.FileName));
            }

            var photos = await photoService.ImportPhotosAsync(StudioId, id, entries, ct);
            return Ok(photos);
        }
        finally
        {
            foreach (var stream in streams) await stream.DisposeAsync();
        }
    }

    [HttpPost("projects/{id:int}/link")]
    public async Task<IActionResult> GenerateLink(int id, GenerateLinkRequestDto request, CancellationToken ct)
    {
        var validation = await generateLinkValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await photoSelectionService.GenerateLinkAsync(StudioId, id, request, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("projects/{id:int}/link")]
    public async Task<IActionResult> RevokeLink(int id, CancellationToken ct)
    {
        var result = await photoSelectionService.RevokeLinkAsync(StudioId, id, ct);
        return result is null ? NotFound() : NoContent();
    }

    [HttpPost("projects/{id:int}/reopen")]
    public async Task<IActionResult> Reopen(int id, CancellationToken ct)
    {
        var result = await photoSelectionService.ReopenAsync(StudioId, id, ct);
        if (result is null)
        {
            return NotFound();
        }
        if (result == false)
        {
            return BadRequest(new { message = "Only a submitted selection can be reopened." });
        }
        return NoContent();
    }

    [HttpPost("projects/{id:int}/process")]
    public async Task<IActionResult> Process(int id, CancellationToken ct)
    {
        var job = await photoSelectionService.StartProcessingAsync(StudioId, id, ct);
        return job is null ? NotFound() : Ok(job);
    }

    [HttpGet("projects/{id:int}/jobs/{jobId:int}")]
    public async Task<IActionResult> GetJob(int id, int jobId, CancellationToken ct)
    {
        var job = await photoSelectionService.GetProcessingJobAsync(StudioId, id, jobId, ct);
        return job is null ? NotFound() : Ok(job);
    }

    [HttpGet("projects/{id:int}/history")]
    public async Task<IActionResult> GetHistory(int id, CancellationToken ct) =>
        Ok(await photoSelectionService.GetHistoryAsync(StudioId, id, ct));

    [HttpGet("projects/{id:int}/report")]
    public async Task<IActionResult> GetReport(int id, CancellationToken ct)
    {
        var csv = await photoSelectionService.GetReportCsvAsync(StudioId, id, ct);
        return csv is null ? NotFound() : File(csv, "text/csv", $"photo-selection-{id}.csv");
    }
}
