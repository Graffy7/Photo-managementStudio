using StudioManagement.API.Filters;
using StudioManagement.API.Realtime;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudioManagement.Business.PhotoSelection;
using StudioManagement.Business.Tenant;
using StudioManagement.Data.Common;
using StudioManagement.Data.Repositories;

namespace StudioManagement.API.Controllers;

// The studio owner's side of photo selection: open a gallery for an event, import the photos from a
// folder, send the private link, and see what the customer picked.
[ApiController]
[Route("api/photo-galleries")]
[Authorize(Roles = UserTypes.StudioOwner)]
[FeatureRequired(FeatureCodes.PhotoSelection)]
public class PhotoGalleriesController(
    IPhotoGalleryService galleryService,
    IPhotoImportService importService,
    IPhotoSelectionCopyService copyService,
    IPhotoFolderService folderService,
    IDevicePhotoService devicePhotos,
    IValidator<ImportRequestDto> importValidator,
    IValidator<GenerateLinkRequestDto> linkValidator,
    IValidator<SaveFolderRequestDto> folderValidator,
    ITenantContext tenantContext) : ControllerBase
{
    private int StudioId => tenantContext.CurrentStudioId!.Value;

    [HttpGet("completed-events")]
    public async Task<IActionResult> CompletedEvents(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await galleryService.GetCompletedEventsAsync(StudioId, search, page, pageSize, ct));

    // Opens the event's gallery, creating it the first time.
    [HttpPost("events/{eventId:int}")]
    public async Task<IActionResult> OpenForEvent(int eventId, CancellationToken ct)
    {
        var gallery = await galleryService.GetOrCreateForEventAsync(StudioId, eventId, ct);
        return gallery is null ? NotFound() : Ok(gallery);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var gallery = await galleryService.GetAsync(StudioId, id, ct);
        return gallery is null ? NotFound() : Ok(gallery);
    }

    // Folders inside this studio's own photo folder (set by Studio OS support), so the owner picks
    // the originals' location instead of typing a path. Nothing outside it can be listed.
    [HttpGet("browse-folders")]
    public async Task<IActionResult> BrowseFolders([FromQuery] string? path, CancellationToken ct)
    {
        var (problem, result) = await importService.BrowseFoldersAsync(StudioId, path, ct);
        return problem == PhotoPathProblem.None ? Ok(result) : PathProblem(problem);
    }

    // 403 for anything outside the studio's folder (or no folder yet), 400 for a malformed path.
    private IActionResult PathProblem(PhotoPathProblem problem) => problem switch
    {
        PhotoPathProblem.NoRoot => StatusCode(StatusCodes.Status403Forbidden, new
        {
            code = "PHOTO_ROOT_NOT_SET",
            message = "Your studio's photo folder hasn't been set up yet. Please contact Studio OS support."
        }),
        PhotoPathProblem.OutsideRoot => StatusCode(StatusCodes.Status403Forbidden, new
        {
            code = "OUTSIDE_PHOTO_ROOT",
            message = "That folder is outside your studio's photo folder."
        }),
        PhotoPathProblem.NotFound => BadRequest(new { message = "That folder wasn't found." }),
        _ => BadRequest(new { message = "That isn't a valid folder path." })
    };

    [HttpPost("{id:int}/import")]
    public async Task<IActionResult> StartImport(int id, ImportRequestDto request, CancellationToken ct)
    {
        var validation = await importValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await importService.StartAsync(StudioId, id, request.SourceFolder, ct);
        if (result.Succeeded)
        {
            return Accepted(result.Job);
        }

        return result.FailureReason switch
        {
            ImportFailureReason.GalleryNotFound => NotFound(),
            ImportFailureReason.FolderNotFound => BadRequest(new { message = "That folder wasn't found on this computer." }),
            ImportFailureReason.FolderNotAllowed => PathProblem(PhotoPathProblem.OutsideRoot),
            ImportFailureReason.NoPhotoRoot => PathProblem(PhotoPathProblem.NoRoot),
            ImportFailureReason.FolderInvalid => PathProblem(PhotoPathProblem.Invalid),
            ImportFailureReason.NoImages => BadRequest(new { message = NoPhotosMessage(result.Skipped) }),
            _ => Conflict(new { message = "An import is already running for this event." })
        };
    }

    // Removes the photos imported from one folder (picked by mistake). Their previews and any
    // customer selections go; the original files in that folder are not touched.
    [HttpPost("{id:int}/imported-folders/remove")]
    public async Task<IActionResult> RemoveImportedFolder(int id, ImportRequestDto request, CancellationToken ct)
    {
        var validation = await importValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await importService.RemoveSourceAsync(StudioId, id, request.SourceFolder, ct);
        if (result.Succeeded)
        {
            return Ok(new { removedCount = result.RemovedCount, selectedRemovedCount = result.SelectedRemovedCount });
        }

        return result.Failure switch
        {
            RemoveSourceFailure.NotFound => NotFound(new { message = "No photos from that folder are in this gallery." }),
            RemoveSourceFailure.JobRunning => Conflict(new { message = "Photos are being imported or copied right now. Try again when that finishes." }),
            _ => NotFound()
        };
    }

    // After the retention period the previews are deleted; this makes them again from the originals
    // so the owner can send a new link.
    // ---- Photos from the studio's own computer (hosted use) ---------------------------------------
    // The browser opens the computer's folder dialog, makes a screen-size copy of each photo locally
    // and uploads only that; the originals stay on the studio's computer.

    // Which photos of that folder already have previews (so choosing the folder again only sends the rest).
    [HttpGet("{id:int}/device-photos")]
    public async Task<IActionResult> DevicePhotosPresent(int id, [FromQuery] string folder, CancellationToken ct)
    {
        var present = await devicePhotos.GetPresentAsync(StudioId, id, folder, ct);
        return present is null ? NotFound() : Ok(new { present });
    }

    // One photo. multipart: file (the browser-made preview), folder (the chosen folder's name),
    // path (the photo's path inside that folder, e.g. "Candid Photos/IMG_0001.JPG").
    [HttpPost("{id:int}/device-photos")]
    [SkipRealtime]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<IActionResult> AddDevicePhoto(int id, [FromForm] IFormFile? file, [FromForm] string? folder, [FromForm] string? path, [FromForm] long? size, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "No image was uploaded." });
        }
        await using var stream = file.OpenReadStream();
        var outcome = await devicePhotos.AddAsync(StudioId, id, folder ?? "", path ?? "", stream, size, ct);
        return outcome switch
        {
            DeviceUploadOutcome.GalleryNotFound => NotFound(),
            DeviceUploadOutcome.InvalidPath => BadRequest(new { message = "That folder or file name can't be used." }),
            DeviceUploadOutcome.NotAPhoto => BadRequest(new { message = "Only JPEG and RAW photos can be added." }),
            DeviceUploadOutcome.InvalidImage => BadRequest(new { message = "That file isn't a readable photo." }),
            _ => Ok(new { outcome = outcome.ToString() })
        };
    }

    // The browser has finished the folder: one log line, and the studio's other devices refresh.
    [HttpPost("{id:int}/device-photos/done")]
    public async Task<IActionResult> DevicePhotosDone(int id, DeviceImportDoneDto request, CancellationToken ct) =>
        await devicePhotos.CompleteAsync(StudioId, id, request.Folder ?? "", request.Added, request.Skipped, request.Failed, ct) ? NoContent() : NotFound();

    // The customer's picks and where each original is inside the chosen folder - the studio's browser
    // copies them into "Customer Selection" on their own computer.
    [HttpGet("{id:int}/device-photos/selection")]
    public async Task<IActionResult> DeviceSelectionFiles(int id, CancellationToken ct)
    {
        var files = await devicePhotos.GetSelectionFilesAsync(StudioId, id, ct);
        return files is null ? NotFound() : Ok(files);
    }

    [HttpPost("{id:int}/rebuild-previews")]
    public async Task<IActionResult> RebuildPreviews(int id, CancellationToken ct)
    {
        if (DevicePhotoService.IsDeviceSource((await galleryService.GetAsync(StudioId, id, ct))?.SourceFolder))
        {
            return Conflict(new { code = "CHOOSE_FOLDER_AGAIN", message = "These photos came from your computer. Choose the same folder again to rebuild the previews." });
        }
        var result = await importService.StartRebuildAsync(StudioId, id, ct);
        if (result.Succeeded)
        {
            return Accepted(result.Job);
        }

        return result.FailureReason switch
        {
            ImportFailureReason.GalleryNotFound => NotFound(),
            ImportFailureReason.FolderNotFound => BadRequest(new { message = "The original photos folder wasn't found on this computer. Import the photos again from where they are now." }),
            ImportFailureReason.FolderNotAllowed => PathProblem(PhotoPathProblem.OutsideRoot),
            ImportFailureReason.NoPhotoRoot => PathProblem(PhotoPathProblem.NoRoot),
            ImportFailureReason.FolderInvalid => PathProblem(PhotoPathProblem.Invalid),
            ImportFailureReason.NoImages => BadRequest(new { message = "All previews are already in place." }),
            _ => Conflict(new { message = "An import is already running for this event." })
        };
    }

    private static string NoPhotosMessage(SkippedFilesDto? skipped)
    {
        const string basic = "No new photos were found in that folder. Only JPEG and RAW photos can be imported.";
        if (skipped is null || skipped.Videos + skipped.Other == 0)
        {
            return basic;
        }

        var parts = new List<string>();
        if (skipped.Videos > 0) parts.Add($"{skipped.Videos} video{(skipped.Videos == 1 ? "" : "s")}");
        if (skipped.Other > 0) parts.Add($"{skipped.Other} other file{(skipped.Other == 1 ? "" : "s")}");
        return $"{basic} This folder has {string.Join(" and ", parts)}, which can't be imported.";
    }

    [HttpGet("{id:int}/import/{jobId:int}")]
    public async Task<IActionResult> GetImportJob(int id, int jobId, CancellationToken ct)
    {
        var job = await importService.GetJobAsync(StudioId, id, jobId, ct);
        return job is null ? NotFound() : Ok(job);
    }

    // "Create Selected Photos" (first time) / "Sync Selected Photos" (afterwards): copies the customer's
    // chosen ORIGINAL files into <original folder>\Customer Selection\Normal and \Big Size.
    [FeatureRequired(FeatureCodes.PhotoDelivery)]
    [HttpPost("{id:int}/selection-copy")]
    public async Task<IActionResult> StartSelectionCopy(int id, CancellationToken ct)
    {
        var result = await copyService.StartAsync(StudioId, id, ct);
        if (result.Succeeded)
        {
            return Accepted(result.Job);
        }

        return result.FailureReason switch
        {
            CopyFailureReason.GalleryNotFound => NotFound(),
            CopyFailureReason.NotSubmitted => BadRequest(new { message = "The customer hasn't submitted their selection yet." }),
            CopyFailureReason.NothingSelected => BadRequest(new { message = "The customer hasn't selected any photos." }),
            CopyFailureReason.NoSourceFolder => BadRequest(new { message = "No photos folder is recorded for this event. Import the photos first." }),
            CopyFailureReason.SourceFolderMissing => BadRequest(new { message = "The photos folder can't be found or opened. Check the drive is connected, then try again." }),
            CopyFailureReason.ImportRunning => Conflict(new { message = "Photos are still being imported. Try again when the import finishes." }),
            _ => Conflict(new { message = "This is already running." })
        };
    }

    [FeatureRequired(FeatureCodes.PhotoDelivery)]
    [HttpGet("{id:int}/selection-copy/{jobId:int}")]
    public async Task<IActionResult> GetSelectionCopyJob(int id, int jobId, CancellationToken ct)
    {
        var job = await copyService.GetJobAsync(StudioId, id, jobId, ct);
        return job is null ? NotFound() : Ok(job);
    }

    [HttpPost("{id:int}/link")]
    public async Task<IActionResult> GenerateLink(int id, GenerateLinkRequestDto request, CancellationToken ct)
    {
        var validation = await linkValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        var result = await galleryService.GenerateLinkAsync(StudioId, id, request.ExpiresInDays, ct);
        if (result.Succeeded)
        {
            return Ok(result.Link);
        }

        return result.FailureReason switch
        {
            LinkFailureReason.GalleryNotFound => NotFound(),
            LinkFailureReason.ImportRunning => Conflict(new { message = "Photos are still being prepared. Send the link once the import finishes." }),
            LinkFailureReason.PreviewsRemoved => BadRequest(new { message = "The previews for this event were deleted after 10 days. Rebuild the previews first, then send a new link." }),
            _ => BadRequest(new { message = "Import the photos first — there is nothing for the customer to choose from yet." })
        };
    }

    [HttpDelete("{id:int}/link")]
    public async Task<IActionResult> RevokeLink(int id, CancellationToken ct) =>
        await galleryService.RevokeLinkAsync(StudioId, id, ct) ? NoContent() : NotFound();

    [HttpPost("{id:int}/lock")]
    public async Task<IActionResult> Lock(int id, CancellationToken ct) =>
        await galleryService.SetLockedAsync(StudioId, id, true, ct) ? NoContent() : NotFound();

    [HttpPost("{id:int}/unlock")]
    public async Task<IActionResult> Unlock(int id, CancellationToken ct) =>
        await galleryService.SetLockedAsync(StudioId, id, false, ct) ? NoContent() : NotFound();

    [HttpGet("{id:int}/photos")]
    public async Task<IActionResult> Photos(
        int id,
        [FromQuery] string? filter,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 60,
        // null = the whole gallery, 0 = photos that aren't in a folder, >0 = that delivery folder.
        [FromQuery] int? folderId = null,
        CancellationToken ct = default)
    {
        var parsed = Enum.TryParse<PhotoFilter>(filter, ignoreCase: true, out var f) ? f : PhotoFilter.All;
        var result = await galleryService.GetPhotosAsync(StudioId, id, parsed, search, page, pageSize, folderId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    // ---- Delivery folders ---------------------------------------------------------------------

    [FeatureRequired(FeatureCodes.PhotoDelivery)]
    [HttpGet("{id:int}/folders")]
    public async Task<IActionResult> Folders(int id, CancellationToken ct)
    {
        var folders = await folderService.GetAsync(StudioId, id, ct);
        return folders is null ? NotFound() : Ok(folders);
    }

    [FeatureRequired(FeatureCodes.PhotoDelivery)]
    [HttpPost("{id:int}/folders")]
    public async Task<IActionResult> CreateFolder(int id, SaveFolderRequestDto request, CancellationToken ct)
    {
        var validation = await folderValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        return FolderResponse(await folderService.CreateAsync(StudioId, id, request, ct));
    }

    [FeatureRequired(FeatureCodes.PhotoDelivery)]
    [HttpPut("{id:int}/folders/{folderId:int}")]
    public async Task<IActionResult> RenameFolder(int id, int folderId, SaveFolderRequestDto request, CancellationToken ct)
    {
        var validation = await folderValidator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            foreach (var error in validation.Errors) ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        return FolderResponse(await folderService.RenameAsync(StudioId, id, folderId, request, ct));
    }

    [FeatureRequired(FeatureCodes.PhotoDelivery)]
    [HttpPost("{id:int}/folders/{folderId:int}/delivered")]
    public async Task<IActionResult> SetFolderDelivered(int id, int folderId, SetFolderDeliveredRequestDto request, CancellationToken ct) =>
        FolderResponse(await folderService.SetDeliveredAsync(StudioId, id, folderId, request.IsDelivered, ct));

    [FeatureRequired(FeatureCodes.PhotoDelivery)]
    [HttpDelete("{id:int}/folders/{folderId:int}")]
    public async Task<IActionResult> DeleteFolder(int id, int folderId, CancellationToken ct)
    {
        var result = await folderService.DeleteAsync(StudioId, id, folderId, ct);
        return result.Succeeded ? NoContent() : FolderResponse(result);
    }

    private IActionResult FolderResponse(FolderResult result)
    {
        if (result.Succeeded)
        {
            return Ok(result.Folder);
        }

        return result.FailureReason switch
        {
            FolderFailureReason.GalleryNotFound => NotFound(),
            FolderFailureReason.FolderNotFound => NotFound(new { message = "That folder no longer exists." }),
            FolderFailureReason.DuplicateName => Conflict(new { message = "This event already has a folder with that name." }),
            _ => BadRequest(new { message = "Invalid request." })
        };
    }

    [HttpGet("{id:int}/export")]
    public async Task<IActionResult> Export(int id, CancellationToken ct)
    {
        var export = await galleryService.ExportSelectionAsync(StudioId, id, ct);
        return export is null ? NotFound() : File(export.Content, "text/csv", export.FileName);
    }

    [FeatureRequired(FeatureCodes.WhatsApp)]
    [BlockWhenReadOnly]
    [HttpGet("{id:int}/share-message")]
    public async Task<IActionResult> ShareMessage(int id, [FromQuery] string baseUrl, [FromQuery] bool reminder = false, CancellationToken ct = default)
    {
        var result = await galleryService.GetShareMessageAsync(StudioId, id, baseUrl, reminder, ct);
        if (result.Succeeded)
        {
            return Ok(result.Share);
        }

        return result.FailureReason switch
        {
            ShareFailureReason.GalleryNotFound => NotFound(),
            ShareFailureReason.InvalidBaseUrl => BadRequest(new { message = "baseUrl must be an http(s) address." }),
            _ => BadRequest(new { message = "There is no active link to share. Generate a new link first." })
        };
    }
}
