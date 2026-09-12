using Microsoft.Extensions.Logging;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;

namespace StudioManagement.Business.PhotoSelection;

public class LocalPhotoProcessor(ILogger<LocalPhotoProcessor> logger) : ILocalPhotoProcessor
{
    public Task<PhotoProcessingRunResult> ProcessAsync(PhotoSelectionProject project, List<Photo> selectedPhotos, CancellationToken ct = default)
    {
        var destinationRoot = string.IsNullOrWhiteSpace(project.DestinationRootFolder)
            ? project.SourceFolder
            : project.DestinationRootFolder;

        var items = new List<PhotoProcessingItemResult>();
        int completed = 0, missing = 0, failed = 0;

        foreach (var photo in selectedPhotos)
        {
            ct.ThrowIfCancellationRequested();

            var sourcePath = Path.Combine(project.SourceFolder, photo.RelativePath);
            var subfolder = photo.SelectionType == PhotoSelectionTypes.Big ? "Big" : "Normal";
            var destFolder = Path.Combine(destinationRoot, "Selected", subfolder);
            var destPath = Path.Combine(destFolder, photo.OriginalFileName);

            if (!File.Exists(sourcePath))
            {
                missing++;
                items.Add(new PhotoProcessingItemResult(photo.PhotoId, PhotoProcessingResults.Missing, $"Source file not found: {sourcePath}"));
                logger.LogWarning("Photo processing: source file missing for PhotoId {PhotoId} at {Path}", photo.PhotoId, sourcePath);
                continue;
            }

            try
            {
                Directory.CreateDirectory(destFolder);
                // File.Copy streams at the OS level — the image bytes never pass through
                // managed memory, so this is safe even for many 20-50MB originals.
                File.Copy(sourcePath, destPath, overwrite: true);
                completed++;
                items.Add(new PhotoProcessingItemResult(photo.PhotoId, PhotoProcessingResults.Copied, null));
            }
            catch (Exception ex)
            {
                failed++;
                items.Add(new PhotoProcessingItemResult(photo.PhotoId, PhotoProcessingResults.Failed, ex.Message));
                logger.LogError(ex, "Photo processing: failed to copy PhotoId {PhotoId} from {Source} to {Dest}", photo.PhotoId, sourcePath, destPath);
            }
        }

        return Task.FromResult(new PhotoProcessingRunResult(completed, missing, failed, items));
    }
}
