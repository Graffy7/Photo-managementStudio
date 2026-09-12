using StudioManagement.Data.Entities;

namespace StudioManagement.Business.PhotoSelection;

public record PhotoProcessingItemResult(int PhotoId, string Result, string? ErrorMessage);
public record PhotoProcessingRunResult(int Completed, int Missing, int Failed, List<PhotoProcessingItemResult> Items);

// The seam between "the app decided which photos are selected" and "the bytes actually get
// organized on disk". Today this runs in-process because the API happens to run on the same
// machine as the studio's photo folder. A real remote Local Agent could implement this same
// interface by polling a jobs endpoint instead — nothing else in this module would need to change.
public interface ILocalPhotoProcessor
{
    Task<PhotoProcessingRunResult> ProcessAsync(PhotoSelectionProject project, List<Photo> selectedPhotos, CancellationToken ct = default);
}
