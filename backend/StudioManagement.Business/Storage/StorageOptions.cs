namespace StudioManagement.Business.Storage;

// "Storage" section of the configuration.
public class StorageOptions
{
    public const string LocalProvider = "Local";

    // Which IFileStorage to use. Only "Local" exists today; a cloud provider (S3-compatible, Azure
    // Blob...) is one new IFileStorage class plus a case in Program.cs - nothing else changes.
    public string Provider { get; set; } = LocalProvider;

    public LocalStorageOptions Local { get; set; } = new();

    // How long a file link handed to a browser keeps working.
    public int SignedUrlHours { get; set; } = 24;

    // Secret for signing file links. Set it on the server (Storage__UrlSigningKey); when missing, a
    // key derived from Jwt:Key is used.
    public string? UrlSigningKey { get; set; }
}

public class LocalStorageOptions
{
    // Folder that holds every stored file. Relative paths are resolved from the API's folder.
    // Put it outside the application folder on a server (e.g. D:\StudioOSData\storage) so deploys,
    // upgrades and moves never touch it.
    public string RootPath { get; set; } = "wwwroot/uploads";
}
