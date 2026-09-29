using StudioManagement.Business.Storage;

namespace StudioManagement.API.Infrastructure;

// Stores files in a folder on this server (Storage:Local:RootPath). Keys map to paths under that
// folder; nothing outside it can ever be read, written or deleted. The folder is NOT served to the
// web directly - browsers get files only through signed /media links (see MediaEndpoints).
public class LocalFileStorage : IFileStorage
{
    private readonly string root;

    public LocalFileStorage(StorageOptions options, IWebHostEnvironment environment)
    {
        var configured = string.IsNullOrWhiteSpace(options.Local.RootPath) ? "wwwroot/uploads" : options.Local.RootPath;
        root = Path.GetFullPath(Path.IsPathRooted(configured) ? configured : Path.Combine(environment.ContentRootPath, configured))
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        Directory.CreateDirectory(root);
    }

    public async Task<string> SaveAsync(Stream content, string fileName, string folder, CancellationToken ct = default)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var key = StorageKey.Normalize($"{folder}/{Guid.NewGuid():N}{extension}")
            ?? throw new ArgumentException($"'{folder}' can't be used as a storage folder.", nameof(folder));
        var path = PathFor(key)!;
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using (var file = File.Create(path))
        {
            await content.CopyToAsync(file, ct);
        }
        return key;
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        Stream? stream = path is not null && File.Exists(path)
            ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true)
            : null;
        return Task.FromResult(stream);
    }

    public async Task<byte[]?> ReadAsync(string key, CancellationToken ct = default)
    {
        var path = PathFor(key);
        return path is not null && File.Exists(path) ? await File.ReadAllBytesAsync(path, ct) : null;
    }

    public void Delete(string key)
    {
        var path = PathFor(key);
        if (path is not null && File.Exists(path))
        {
            File.Delete(path);
        }
    }

    public long GetSize(string key)
    {
        var path = PathFor(key);
        if (path is null)
        {
            return 0;
        }
        var info = new FileInfo(path);
        return info.Exists ? info.Length : 0;
    }

    // Null for anything that isn't a clean key or would resolve outside the storage folder.
    private string? PathFor(string key)
    {
        var clean = StorageKey.Normalize(key);
        if (clean is null)
        {
            return null;
        }
        var full = Path.GetFullPath(Path.Combine(root, clean.Replace('/', Path.DirectorySeparatorChar)));
        return full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ? full : null;
    }
}
