using StudioManagement.Data.Repositories;

namespace StudioManagement.Business.PhotoSelection;

public enum PhotoPathProblem
{
    None,
    // Not a usable path: relative, "..", device/stream syntax.
    Invalid,
    // Outside the studio's photo root, or reached through a shortcut/junction.
    OutsideRoot,
    NotFound,
    // The studio has no photo root yet, so no folder is allowed.
    NoRoot
}

public enum SetPhotoRootProblem
{
    None,
    Invalid,
    NotFound,
    DriveRoot,
    SystemFolder,
    OverlapsAnotherStudio
}

public record PhotoRootInfo(string? Root, bool SetByAdmin, bool FromBaseFolder);

public interface IStudioPhotoRootService
{
    // The folder this studio's photos must live under, or null when none is set (everything blocked).
    Task<string?> GetRootAsync(int studioId, CancellationToken ct = default);
    Task<PhotoRootInfo> GetInfoAsync(int studioId, CancellationToken ct = default);

    // Checks a folder against the studio's root. `full` is the normalised path when allowed.
    Task<(PhotoPathProblem Problem, string? Full)> CheckAsync(int studioId, string? path, CancellationToken ct = default);

    // Super admin only: sets (or clears with null/empty) a studio's photo root.
    Task<SetPhotoRootProblem> SetRootAsync(int studioId, string? path, CancellationToken ct = default);
}

// Every studio gets its own photo folder; browsing, importing, rebuilding previews and copying the
// customer's selection never leave it. The root is set by the platform admin (never by the studio),
// or comes from PhotoGallery:StudioRootBase\{studioId} when that is configured.
public class StudioPhotoRootService(IStudioSettingRepository settings, PhotoGalleryOptions options) : IStudioPhotoRootService
{
    public const string SettingKey = "PhotoGallery.RootFolder";

    public async Task<string?> GetRootAsync(int studioId, CancellationToken ct = default) =>
        (await GetInfoAsync(studioId, ct)).Root;

    public async Task<PhotoRootInfo> GetInfoAsync(int studioId, CancellationToken ct = default)
    {
        var explicitRoot = (await settings.GetAllForStudioAsync(studioId, ct))
            .FirstOrDefault(s => s.SettingKey == SettingKey)?.SettingValue;
        if (!string.IsNullOrWhiteSpace(explicitRoot))
        {
            return new PhotoRootInfo(Normalise(explicitRoot), SetByAdmin: true, FromBaseFolder: false);
        }

        if (!string.IsNullOrWhiteSpace(options.StudioRootBase))
        {
            var root = Path.Combine(Normalise(options.StudioRootBase), studioId.ToString());
            Directory.CreateDirectory(root);
            return new PhotoRootInfo(root, SetByAdmin: false, FromBaseFolder: true);
        }

        return new PhotoRootInfo(null, false, false);
    }

    public async Task<(PhotoPathProblem Problem, string? Full)> CheckAsync(int studioId, string? path, CancellationToken ct = default)
    {
        var root = await GetRootAsync(studioId, ct);
        if (root is null)
        {
            return (PhotoPathProblem.NoRoot, null);
        }
        var problem = Check(root, path, out var full);
        return (problem, problem == PhotoPathProblem.None ? full : null);
    }

    // The rules, kept free of I/O besides existence/link checks so they are easy to reason about.
    public static PhotoPathProblem Check(string root, string? path, out string full)
    {
        full = "";
        if (string.IsNullOrWhiteSpace(path))
        {
            return PhotoPathProblem.Invalid;
        }

        var input = path.Trim();
        if (input.Contains('\0')
            || input.StartsWith(@"\\?\") || input.StartsWith(@"\\.\") || input.StartsWith("//?/") || input.StartsWith("//./")
            || (input.Length > 2 && input.IndexOf(':', 2) >= 0)                                  // alternate data streams
            || input.Split('\\', '/').Any(segment => segment == "..")
            || !Path.IsPathFullyQualified(input))
        {
            return PhotoPathProblem.Invalid;
        }

        string rootFull;
        try
        {
            full = Normalise(input);
            rootFull = Normalise(root);
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return PhotoPathProblem.Invalid;
        }

        if (!IsSameOrUnder(full, rootFull))
        {
            return PhotoPathProblem.OutsideRoot;
        }
        if (!Directory.Exists(full))
        {
            return PhotoPathProblem.NotFound;
        }

        // A junction/symlink anywhere between the root and the folder could point anywhere on the
        // machine, so none are followed.
        for (var dir = new DirectoryInfo(full); dir is not null && !SamePath(dir.FullName, rootFull); dir = dir.Parent)
        {
            if (dir.Attributes.HasFlag(FileAttributes.ReparsePoint) || dir.LinkTarget is not null)
            {
                return PhotoPathProblem.OutsideRoot;
            }
        }

        return PhotoPathProblem.None;
    }

    public async Task<SetPhotoRootProblem> SetRootAsync(int studioId, string? path, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            await settings.UpsertManyAsync(studioId, new Dictionary<string, string?> { [SettingKey] = "" }, ct);
            return SetPhotoRootProblem.None;
        }

        var input = path.Trim();
        if (input.Split('\\', '/').Any(s => s == "..") || !Path.IsPathFullyQualified(input) || input.StartsWith(@"\\?\") || input.StartsWith(@"\\.\"))
        {
            return SetPhotoRootProblem.Invalid;
        }

        string full;
        try
        {
            full = Normalise(input);
        }
        catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return SetPhotoRootProblem.Invalid;
        }

        if (SamePath(Path.GetPathRoot(full) ?? "", full))
        {
            return SetPhotoRootProblem.DriveRoot;
        }
        if (!Directory.Exists(full))
        {
            return SetPhotoRootProblem.NotFound;
        }
        if (new DirectoryInfo(full).LinkTarget is not null)
        {
            return SetPhotoRootProblem.Invalid;
        }

        var system = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.Windows),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            AppContext.BaseDirectory,
            Directory.GetCurrentDirectory()
        }.Where(p => !string.IsNullOrEmpty(p)).Select(Normalise);
        if (system.Any(s => Overlaps(s, full)))
        {
            return SetPhotoRootProblem.SystemFolder;
        }

        // No two studios may share any folder: neither root may contain the other.
        var others = (await settings.GetValuesForKeyAsync(SettingKey, ct))
            .Where(kv => kv.Key != studioId)
            .Select(kv => Normalise(kv.Value));
        if (others.Any(o => Overlaps(o, full)))
        {
            return SetPhotoRootProblem.OverlapsAnotherStudio;
        }
        if (!string.IsNullOrWhiteSpace(options.StudioRootBase))
        {
            var baseFull = Normalise(options.StudioRootBase);
            var own = Path.Combine(baseFull, studioId.ToString());
            if (Overlaps(baseFull, full) && !IsSameOrUnder(full, own))
            {
                return SetPhotoRootProblem.OverlapsAnotherStudio;
            }
        }

        await settings.UpsertManyAsync(studioId, new Dictionary<string, string?> { [SettingKey] = full }, ct);
        return SetPhotoRootProblem.None;
    }

    // Recursion options for scanning inside a root: never step through junctions/symlinks.
    public static EnumerationOptions SafeEnumeration(bool recurse) => new()
    {
        RecurseSubdirectories = recurse,
        IgnoreInaccessible = true,
        AttributesToSkip = FileAttributes.ReparsePoint | FileAttributes.System
    };

    private static string Normalise(string path)
    {
        var full = Path.GetFullPath(path.Trim());
        var rootPart = Path.GetPathRoot(full) ?? "";
        return full.Length > rootPart.Length ? full.TrimEnd('\\', '/') : full;
    }

    private static bool SamePath(string a, string b) =>
        string.Equals(a.TrimEnd('\\', '/'), b.TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase);

    private static bool IsSameOrUnder(string path, string root)
    {
        var r = root.TrimEnd('\\', '/');
        return SamePath(path, r) || path.StartsWith(r + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
    }

    private static bool Overlaps(string a, string b) => IsSameOrUnder(a, b) || IsSameOrUnder(b, a);
}
