namespace StudioManagement.Business.Storage;

// Where uploaded files (photo previews/thumbnails, studio logos, PDF signatures) physically live.
// Callers only ever see a storage KEY such as "photo-gallery/12/3f2a….webp" - never a disk path or
// a URL - so the files can move to another folder, server or cloud store by switching the provider
// in configuration (Storage:Provider). Keys are what the database stores; IFileUrlService turns a
// key into a (signed, expiring) address when a screen needs to show the file.
public interface IFileStorage
{
    // Stores the content under "<folder>/<new random name><extension of fileName>" and returns that key.
    Task<string> SaveAsync(Stream content, string fileName, string folder, CancellationToken ct = default);

    // Opens a stored file for reading, or null when it doesn't exist.
    Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default);

    Task<byte[]?> ReadAsync(string key, CancellationToken ct = default);

    void Delete(string key);

    // Size in bytes of a stored file, or 0 when it doesn't exist.
    long GetSize(string key);
}
