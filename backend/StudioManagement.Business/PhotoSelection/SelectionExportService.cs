using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StudioManagement.Business.Audit;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.PhotoSelection;

// One selected photo in an export: where it goes (<root>\<Category>\<Normal|Big Size>\<file name>)
// and where its ORIGINAL comes from. The browser never sends a path - it only ever asks for photo ids
// listed here, and the server works out the file itself.
public class SelectionExportFileDto
{
    public int PhotoId { get; set; }
    public int PhotoNumber { get; set; }
    // The delivery folder's name made safe for Windows ("Candid Photos", "Reception"...).
    public string Category { get; set; } = null!;
    // "Normal" or "Big Size" - the same rule as Create Selected Photos (SelectionFolders).
    public string SizeFolder { get; set; } = null!;
    // The original file name; a second photo with the same name in the same folder gets " (2)".
    public string FileName { get; set; } = null!;
    public string? RenamedFrom { get; set; }
    // "Server" = the original is in the studio's photo folder on the server and can be downloaded.
    // "Computer" = it was added from the studio's own computer and never uploaded; the browser reads it there.
    public string Location { get; set; } = null!;
    // Computer only: the folder name it was added from and its path inside that folder.
    public string? ComputerFolder { get; set; }
    public string? ComputerRelativePath { get; set; }
    public long? FileSize { get; set; }
}

public class SelectionExportManifestDto
{
    public string RootFolderName { get; set; } = null!;
    public int SelectedCount { get; set; }
    public int NormalCount { get; set; }
    public int BigCount { get; set; }
    public int ServerCount { get; set; }
    public int ComputerCount { get; set; }
    public List<string> Categories { get; set; } = [];
    public List<SelectionExportFileDto> Files { get; set; } = [];
}

public record OriginalFile(Stream Content, string FileName, long Length);

public enum OriginalProblem { None, NotFound, NotOnServer, NoStudioFolder, PathNotAllowed, Missing, Unreadable }

public interface ISelectionExportService
{
    Task<SelectionExportManifestDto?> GetManifestAsync(int studioId, int galleryId, CancellationToken ct = default);

    // Opens one selected photo's original for reading. Only photos that are selected in this studio's
    // gallery and stored on the server qualify; the path comes from the database, never the caller.
    Task<(OriginalProblem Problem, OriginalFile? File)> OpenOriginalAsync(int studioId, int galleryId, int photoId, CancellationToken ct = default);

    // A short-lived link for the ZIP download (a browser download can't send the sign-in header).
    string CreateZipLink(int studioId, int galleryId, TimeSpan lifetime);
    (int StudioId, int GalleryId)? ReadZipLink(string? token);

    // Writes the ZIP: the same folder structure, the server-stored originals, and a report of anything
    // that couldn't be included. Returns null when the gallery isn't this studio's.
    Task<string?> GetZipFileNameAsync(int studioId, int galleryId, CancellationToken ct = default);
    Task WriteZipAsync(int studioId, int galleryId, Stream output, CancellationToken ct = default);
}

public class SelectionExportService(
    IPhotoGalleryRepository galleryRepository,
    IPhotoRepository photoRepository,
    IPhotoFolderRepository folderRepository,
    IEventRepository eventRepository,
    IStudioPhotoRootService photoRoots,
    IAuditService auditService,
    IConfiguration configuration,
    ILogger<SelectionExportService> logger) : ISelectionExportService
{
    private const string Module = "PhotoSelection";
    public const string LocationServer = "Server";
    public const string LocationComputer = "Computer";
    private const string NoCategory = "Uncategorised";

    public async Task<SelectionExportManifestDto?> GetManifestAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        return gallery is null ? null : await BuildManifestAsync(studioId, gallery, ct);
    }

    private async Task<SelectionExportManifestDto> BuildManifestAsync(int studioId, PhotoGallery gallery, CancellationToken ct)
    {
        var selected = (await photoRepository.GetSelectedAsync(gallery.PhotoGalleryId, ct))
            .Where(s => s.SelectionType is SelectionTypes.Normal or SelectionTypes.Big && s.Photo.IsActive)
            .ToList();
        var folders = (await folderRepository.GetByGalleryAsync(gallery.PhotoGalleryId, ct))
            .ToDictionary(f => f.PhotoFolderId, f => SafeFolderName(f.Name, NoCategory));
        var @event = await eventRepository.GetByIdAsync(studioId, gallery.EventId, ct);
        var root = SafeFolderName($"{@event?.EventType?.Name ?? "Event"}_Selected", "Event_Selected");

        var files = new List<SelectionExportFileDto>();
        // Names already used in each destination folder (Windows names ignore case).
        var used = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in selected.OrderBy(s => s.Photo.PhotoNumber))
        {
            var photo = s.Photo;
            var category = photo.PhotoFolderId is int fid && folders.TryGetValue(fid, out var name) ? name : NoCategory;
            var size = SelectionFolders.NameFor(s.SelectionType!.Value);
            var original = SafeFileName(OriginalName(photo));
            var key = $"{category}\\{size}";
            if (!used.TryGetValue(key, out var names))
            {
                used[key] = names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            }
            var fileName = UniqueName(original, names);
            names.Add(fileName);

            var onComputer = DevicePhotoService.IsDeviceSource(photo.SourceFolder);
            files.Add(new SelectionExportFileDto
            {
                PhotoId = photo.PhotoId,
                PhotoNumber = photo.PhotoNumber,
                Category = category,
                SizeFolder = size,
                FileName = fileName,
                RenamedFrom = fileName == original ? null : original,
                Location = onComputer ? LocationComputer : LocationServer,
                ComputerFolder = onComputer ? photo.SourceFolder![DevicePhotoService.SourcePrefix.Length..] : null,
                ComputerRelativePath = onComputer ? photo.SourceRelativePath.Replace('\\', '/') : null,
                FileSize = photo.FileSize
            });
        }

        return new SelectionExportManifestDto
        {
            RootFolderName = root,
            SelectedCount = files.Count,
            NormalCount = files.Count(f => f.SizeFolder == SelectionFolders.NormalName),
            BigCount = files.Count(f => f.SizeFolder == SelectionFolders.BigName),
            ServerCount = files.Count(f => f.Location == LocationServer),
            ComputerCount = files.Count(f => f.Location == LocationComputer),
            Categories = files.Select(f => f.Category).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(c => c, StringComparer.OrdinalIgnoreCase).ToList(),
            Files = files
        };
    }

    public async Task<(OriginalProblem Problem, OriginalFile? File)> OpenOriginalAsync(int studioId, int galleryId, int photoId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return (OriginalProblem.NotFound, null);
        }
        // Only a photo that is selected right now, in this gallery.
        var entry = (await photoRepository.GetSelectedAsync(galleryId, ct))
            .FirstOrDefault(s => s.Photo.PhotoId == photoId && s.SelectionType is not null && s.Photo.IsActive);
        if (entry is null)
        {
            return (OriginalProblem.NotFound, null);
        }
        var studioRoot = await photoRoots.GetRootAsync(studioId, ct);
        var (problem, path) = ResolveOriginal(gallery, entry.Photo, studioRoot);
        if (problem != OriginalProblem.None)
        {
            return (problem, null);
        }
        try
        {
            var stream = new FileStream(path!, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
            return (OriginalProblem.None, new OriginalFile(stream, Path.GetFileName(path!), stream.Length));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Couldn't open original for photo {PhotoId}", photoId);
            return (OriginalProblem.Unreadable, null);
        }
    }

    // The original's full path from what the database recorded - inside the studio's photo folder and
    // inside the photo's own import folder, or not at all.
    private static (OriginalProblem, string?) ResolveOriginal(PhotoGallery gallery, Photo photo, string? studioRoot)
    {
        if (DevicePhotoService.IsDeviceSource(photo.SourceFolder))
        {
            return (OriginalProblem.NotOnServer, null);
        }
        var folder = photo.SourceFolder ?? gallery.SourceFolder;
        if (studioRoot is null)
        {
            return (OriginalProblem.NoStudioFolder, null);
        }
        if (string.IsNullOrWhiteSpace(folder))
        {
            return (OriginalProblem.PathNotAllowed, null);
        }
        if (StudioPhotoRootService.Check(studioRoot, folder, out var folderFull) != PhotoPathProblem.None)
        {
            return (OriginalProblem.PathNotAllowed, null);
        }
        var full = Path.GetFullPath(Path.Combine(folderFull, photo.SourceRelativePath));
        var folderWithSlash = Path.EndsInDirectorySeparator(folderFull) ? folderFull : folderFull + Path.DirectorySeparatorChar;
        if (!full.StartsWith(folderWithSlash, StringComparison.OrdinalIgnoreCase))
        {
            return (OriginalProblem.PathNotAllowed, null);
        }
        return File.Exists(full) ? (OriginalProblem.None, full) : (OriginalProblem.Missing, null);
    }

    // ---- ZIP ---------------------------------------------------------------------------------------

    public string CreateZipLink(int studioId, int galleryId, TimeSpan lifetime)
    {
        var expires = DateTimeOffset.UtcNow.Add(lifetime).ToUnixTimeSeconds();
        var body = $"{studioId}.{galleryId}.{expires}";
        return $"{body}.{Sign(body)}";
    }

    public (int StudioId, int GalleryId)? ReadZipLink(string? token)
    {
        var parts = token?.Split('.');
        if (parts is not { Length: 4 }
            || !int.TryParse(parts[0], out var studioId) || !int.TryParse(parts[1], out var galleryId)
            || !long.TryParse(parts[2], out var expires))
        {
            return null;
        }
        var expected = Encoding.ASCII.GetBytes(Sign($"{parts[0]}.{parts[1]}.{parts[2]}"));
        if (!CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(parts[3])))
        {
            return null;
        }
        return DateTimeOffset.UtcNow.ToUnixTimeSeconds() <= expires ? (studioId, galleryId) : null;
    }

    private string Sign(string body)
    {
        var secret = configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.");
        var key = SHA256.HashData(Encoding.UTF8.GetBytes("selection-export-zip:" + secret));
        var mac = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(body));
        return Convert.ToBase64String(mac).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public async Task<string?> GetZipFileNameAsync(int studioId, int galleryId, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct);
        if (gallery is null)
        {
            return null;
        }
        var @event = await eventRepository.GetByIdAsync(studioId, gallery.EventId, ct);
        return SafeFolderName($"{@event?.EventType?.Name ?? "Event"}_Selected", "Event_Selected") + ".zip";
    }

    public async Task WriteZipAsync(int studioId, int galleryId, Stream output, CancellationToken ct = default)
    {
        var gallery = await galleryRepository.GetByIdAsync(studioId, galleryId, ct)
            ?? throw new InvalidOperationException("Gallery not found.");
        var manifest = await BuildManifestAsync(studioId, gallery, ct);
        var selected = (await photoRepository.GetSelectedAsync(galleryId, ct)).ToDictionary(s => s.Photo.PhotoId);
        var studioRoot = await photoRoots.GetRootAsync(studioId, ct);
        var problems = new List<string>();
        var added = 0;

        // Photos are already compressed: storing them as they are keeps the ZIP fast and the files identical.
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            // Both size folders for every category, even when one of them has no photos.
            foreach (var category in manifest.Categories)
            {
                zip.CreateEntry($"{manifest.RootFolderName}/{category}/{SelectionFolders.NormalName}/");
                zip.CreateEntry($"{manifest.RootFolderName}/{category}/{SelectionFolders.BigName}/");
            }
            foreach (var file in manifest.Files)
            {
                ct.ThrowIfCancellationRequested();
                var entryName = $"{manifest.RootFolderName}/{file.Category}/{file.SizeFolder}/{file.FileName}";
                if (file.Location == LocationComputer)
                {
                    problems.Add($"{file.Category}/{file.SizeFolder}/{file.FileName}: the original is on the studio's own computer, not on the server. Use 'Choose destination folder' in Chrome or Edge on that computer.");
                    continue;
                }
                var (problem, path) = ResolveOriginal(gallery, selected[file.PhotoId].Photo, studioRoot);
                if (problem != OriginalProblem.None)
                {
                    problems.Add($"{file.Category}/{file.SizeFolder}/{file.FileName}: {Describe(problem)}");
                    continue;
                }
                try
                {
                    await using var source = new FileStream(path!, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
                    var entry = zip.CreateEntry(entryName, CompressionLevel.NoCompression);
                    entry.LastWriteTime = File.GetLastWriteTime(path!);
                    await using var target = entry.Open();
                    await source.CopyToAsync(target, ct);
                    added++;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    logger.LogWarning(ex, "Couldn't add {File} to the selection ZIP", file.FileName);
                    problems.Add($"{file.Category}/{file.SizeFolder}/{file.FileName}: {Describe(OriginalProblem.Unreadable)}");
                }
            }

            // Always included, so the ZIP itself says whether it is complete.
            var report = new StringBuilder()
                .AppendLine($"Selected photos: {manifest.SelectedCount} ({manifest.NormalCount} Normal, {manifest.BigCount} Big Size)")
                .AppendLine($"Included in this ZIP: {added}")
                .AppendLine($"Not included: {problems.Count}");
            if (problems.Count > 0)
            {
                report.AppendLine().AppendLine("Not included:");
                foreach (var p in problems)
                {
                    report.AppendLine(" - " + p);
                }
            }
            var reportEntry = zip.CreateEntry($"{manifest.RootFolderName}/Export report.txt", CompressionLevel.Optimal);
            await using (var writer = new StreamWriter(reportEntry.Open(), new UTF8Encoding(false)))
            {
                await writer.WriteAsync(report.ToString());
            }
        }

        await auditService.LogAsync(
            $"Selected photos downloaded as ZIP for event {gallery.EventId} ({added} of {manifest.SelectedCount} included)", Module, studioId, ct);
    }

    public static string Describe(OriginalProblem problem) => problem switch
    {
        OriginalProblem.Missing => "the original file wasn't found (moved, renamed or deleted?)",
        OriginalProblem.PathNotAllowed => "its folder is outside the studio's photo folder",
        OriginalProblem.NoStudioFolder => "the studio's photo folder isn't set up on the server (the platform admin sets it)",
        OriginalProblem.NotOnServer => "the original is on the studio's own computer, not on the server",
        OriginalProblem.Unreadable => "the original couldn't be read (is it open in another program?)",
        _ => "not found"
    };

    // ---- Names -------------------------------------------------------------------------------------

    private static readonly HashSet<string> ReservedNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    };

    // A name Windows (and every other system) accepts as one folder: no separators or reserved
    // characters, no trailing dots or spaces, not a device name, not "." or "..".
    public static string SafeFolderName(string? name, string fallback)
    {
        var cleaned = Clean(name, 80);
        return cleaned.Length == 0 || cleaned.Trim('.').Length == 0 ? fallback : cleaned;
    }

    private static string SafeFileName(string name)
    {
        var cleaned = Clean(name, 180);
        return cleaned.Length == 0 || cleaned.Trim('.').Length == 0 ? "photo.jpg" : cleaned;
    }

    private static string Clean(string? name, int max)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "";
        }
        var sb = new StringBuilder(name.Length);
        foreach (var c in name.Trim())
        {
            sb.Append(c < 32 || "<>:\"/\\|?*".Contains(c) ? '_' : c);
        }
        var result = sb.ToString();
        if (result.Length > max)
        {
            result = result[..max];
        }
        result = result.TrimEnd('.', ' ');
        var stem = result.Split('.')[0];
        return ReservedNames.Contains(stem) ? "_" + result : result;
    }

    private static string OriginalName(Photo photo)
    {
        var fromPath = photo.SourceRelativePath.Split(['\\', '/'], StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
        return string.IsNullOrWhiteSpace(fromPath) ? photo.FileName : fromPath;
    }

    private static string UniqueName(string name, HashSet<string> used)
    {
        if (!used.Contains(name))
        {
            return name;
        }
        var stem = Path.GetFileNameWithoutExtension(name);
        var ext = Path.GetExtension(name);
        for (var n = 2; ; n++)
        {
            var candidate = $"{stem} ({n}){ext}";
            if (!used.Contains(candidate))
            {
                return candidate;
            }
        }
    }
}
