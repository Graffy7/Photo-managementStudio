using StudioManagement.Business.Storage;

namespace StudioManagement.API.Infrastructure;

// GET /media/{key}?exp=&sig= - the only way a browser can load a stored file (photo previews,
// thumbnails, logos, signatures). No login is needed because the signed link itself is the
// permission: it's only handed out by endpoints that already checked the studio / customer link.
public static class MediaEndpoints
{
    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".webp"] = "image/webp",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
    };

    public static void MapMedia(this IEndpointRouteBuilder app)
    {
        app.MapGet(SignedFileUrlService.RoutePrefix + "{**key}", async (
            string key, long? exp, string? sig, SignedFileUrlService links, IFileStorage storage, HttpContext http, CancellationToken ct) =>
        {
            var clean = StorageKey.Normalize(key);
            if (clean is null || exp is null || !links.IsValid(clean, exp.Value, sig))
            {
                // Same answer for a bad, altered or expired link - nothing about the file is revealed.
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }
            if (!ContentTypes.TryGetValue(Path.GetExtension(clean), out var contentType))
            {
                return Results.NotFound();
            }
            var stream = await storage.OpenReadAsync(clean, ct);
            if (stream is null)
            {
                return Results.NotFound();
            }
            // Cacheable by this browser only, and never beyond the link's own expiry.
            http.Response.Headers.CacheControl = $"private, max-age={links.SecondsLeft(exp.Value)}";
            return Results.Stream(stream, contentType);
        }).AllowAnonymous();
    }
}
