namespace StudioManagement.Business.Storage;

// Turns a storage key into the address a browser uses to load the file. Addresses are built fresh
// for every response (never stored), signed, and expire - a copied link stops working after a while,
// and nobody can reach a file without being handed its link by an endpoint that checked access.
public interface IFileUrlService
{
    // Null in, null out; also null for a value that isn't a valid key.
    string? GetUrl(string? key);
}
