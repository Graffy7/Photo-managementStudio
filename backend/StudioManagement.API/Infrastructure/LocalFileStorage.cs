using StudioManagement.Business.Storage;

namespace StudioManagement.API.Infrastructure;

// Saves under wwwroot/uploads/<folder>/<guid><ext> and serves it back via app.UseStaticFiles(),
// so the returned "relativeUrl" is a plain public path like "/uploads/logos/3/abc123.png" — no
// auth in front of it, since a studio's logo isn't sensitive. Kept behind IFileStorage so this
// can be swapped for blob/S3 storage later without touching callers.
public class LocalFileStorage(IWebHostEnvironment environment) : IFileStorage
{
    private const string UploadsRoot = "uploads";

    public async Task<string> SaveAsync(Stream content, string fileName, string folder, CancellationToken ct = default)
    {
        var extension = Path.GetExtension(fileName);
        var storedName = $"{Guid.NewGuid():N}{extension}";
        var relativeFolder = Path.Combine(UploadsRoot, folder);
        var webRoot = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
        var absoluteFolder = Path.Combine(webRoot, relativeFolder);

        Directory.CreateDirectory(absoluteFolder);

        var absolutePath = Path.Combine(absoluteFolder, storedName);
        await using (var fileStream = File.Create(absolutePath))
        {
            await content.CopyToAsync(fileStream, ct);
        }

        return "/" + Path.Combine(relativeFolder, storedName).Replace('\\', '/');
    }

    public void Delete(string relativeUrl)
    {
        var absolutePath = ResolveAbsolutePath(relativeUrl);
        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }
    }

    public async Task<byte[]?> ReadAsync(string relativeUrl, CancellationToken ct = default)
    {
        var absolutePath = ResolveAbsolutePath(relativeUrl);
        return File.Exists(absolutePath) ? await File.ReadAllBytesAsync(absolutePath, ct) : null;
    }

    private string ResolveAbsolutePath(string relativeUrl)
    {
        var webRoot = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
        var relativePath = relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        return Path.Combine(webRoot, relativePath);
    }
}
