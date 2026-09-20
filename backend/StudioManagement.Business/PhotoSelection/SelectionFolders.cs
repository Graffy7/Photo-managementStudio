namespace StudioManagement.Business.PhotoSelection;

// Where "Create Selected Photos" writes: <original folder>\Customer Selection\Normal and \Big Size.
public static class SelectionFolders
{
    public const string RootName = "Customer Selection";
    public const string NormalName = "Normal";
    public const string BigName = "Big Size";

    public static string NameFor(int selectionType) => selectionType == 2 ? BigName : NormalName;

    // True when a path (relative to an import folder) sits inside a Customer Selection folder. Those
    // files are our own generated copies, so imports must never treat them as new photos.
    public static bool IsInsideGenerated(string relativePath)
    {
        var segments = relativePath.Split([Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar],StringSplitOptions.RemoveEmptyEntries);
        return segments.Length > 1 && segments[..^1].Any(s => s.Equals(RootName, StringComparison.OrdinalIgnoreCase));
    }
}
