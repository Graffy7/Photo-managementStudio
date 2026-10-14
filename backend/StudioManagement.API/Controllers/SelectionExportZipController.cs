using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudioManagement.Business.PhotoSelection;

namespace StudioManagement.API.Controllers;

// The ZIP download of a gallery's selected originals. A browser download can't send the sign-in
// header, so access is by the short-lived signed link the owner's signed-in session asked for
// (POST /api/photo-galleries/{id}/selection-export/zip-link). The link names its studio and gallery.
[ApiController]
[Route("api/selection-export-zip")]
[AllowAnonymous]
public class SelectionExportZipController(ISelectionExportService exportService) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("expensive")]
    public async Task Download([FromQuery(Name = "t")] string? token, CancellationToken ct)
    {
        if (exportService.ReadZipLink(token) is not { } link)
        {
            Response.StatusCode = StatusCodes.Status403Forbidden;
            await Response.WriteAsJsonAsync(new { message = "This download link has expired. Start the download again from the gallery." }, ct);
            return;
        }
        var fileName = await exportService.GetZipFileNameAsync(link.StudioId, link.GalleryId, ct);
        if (fileName is null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        Response.ContentType = "application/zip";
        Response.Headers.ContentDisposition = new System.Net.Mime.ContentDisposition { FileName = fileName }.ToString();
        // The ZIP is written straight to the response as it is built (no temporary copy on the server);
        // ZipArchive writes some parts synchronously, so that is allowed for this one response.
        var bodyControl = HttpContext.Features.Get<IHttpBodyControlFeature>();
        if (bodyControl is not null)
        {
            bodyControl.AllowSynchronousIO = true;
        }
        await exportService.WriteZipAsync(link.StudioId, link.GalleryId, Response.Body, ct);
    }
}
