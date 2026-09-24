namespace StudioManagement.Business.Storage;

public interface IFileStorage
{
    Task<string> SaveAsync(Stream content, string fileName, string folder, CancellationToken ct = default);
    void Delete(string relativeUrl);
    Task<byte[]?> ReadAsync(string relativeUrl, CancellationToken ct = default);

    // Size in bytes of a stored file, or 0 when it doesn't exist.
    long GetSize(string relativeUrl);
}
