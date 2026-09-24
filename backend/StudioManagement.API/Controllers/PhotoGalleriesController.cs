using StudioManagement.API.Filters;
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

    // Folders on the studio's own machine, so the owner picks the originals' location instead of
    // typing a path. Restricted to PhotoGallery:AllowedImportRoots when that is configured.
    [HttpGet("browse-folders")]
    public IActionResult BrowseFolders([FromQuery] string? path)
    {
        var result = importService.BrowseFolders(path);
        return result is null ? BadRequest(new { message = "That folder can't be opened." }) : Ok(result);
    }

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
            ImportFailureReason.FolderNotAllowed => BadRequest(new { message = "Photos can't be imported from that folder." }),
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
    [HttpPost("{id:int}/rebuild-previews")]
    public async Task<IActionResult> RebuildPreviews(int id, CancellationToken ct)
    {
        var result = await importService.StartRebuildAsync(StudioId, id, ct);
        if (result.Succeeded)
        {
            return Accepted(result.Job);
        }

        return result.FailureReason switch
        {
            ImportFailureReason.GalleryNotFound => NotFound(),
            ImportFailureReason.FolderNotFound => BadRequest(new { message = "The original photos folder wasn't found on this computer. Import the photos again from where they are now." }),
            ImportFailureReason.FolderNotAllowed => BadRequest(new { message = "Photos can't be read from that folder." }),
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
