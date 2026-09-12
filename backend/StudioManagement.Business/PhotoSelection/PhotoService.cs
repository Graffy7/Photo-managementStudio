using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using StudioManagement.Data.Common;
using StudioManagement.Data.Entities;
using StudioManagement.Data.Repositories;
using StudioManagement.Business.Storage;
using StudioManagement.Business.Notifications;
using StudioManagement.Business.Common;
using StudioManagement.Data.UnitOfWork;

namespace StudioManagement.Business.PhotoSelection;

public class PhotoService(
    IPhotoRepository photoRepository,
    IPhotoSelectionProjectRepository projectRepository,
    IPhotoSelectionActivityRepository activityRepository,
    IFileStorage fileStorage,
    IUnitOfWork unitOfWork) : IPhotoService
{
    // The customer only needs enough resolution to recognize the shot — these are the "exact
    // compression should be configurable" knobs from the spec; a Settings-tab control could
    // read/write these later without touching the resize/encode logic itself.
    private const int PreviewMaxDimension = 1600;
    private const int ThumbnailMaxDimension = 320;
    private const int JpegQuality = 80;

    public async Task<List<PhotoDto>> ImportPhotosAsync(
        int studioId, int projectId,
        List<(Stream Content, string OriginalFileName, string RelativePath)> files,
        CancellationToken ct = default)
    {
        var project = await projectRepository.GetByIdAsync(studioId, projectId, ct)
            ?? throw new InvalidOperationException("Project not found.");

        var nextNumber = await photoRepository.GetMaxPhotoNumberAsync(projectId, ct) + 1;
        var now = DateTime.UtcNow;
        var photos = new List<Photo>();

        foreach (var file in files)
        {
            using var image = await Image.LoadAsync(file.Content, ct);

            var previewBytes = await EncodeAsync(image, PreviewMaxDimension, ct);
            var thumbnailBytes = await EncodeAsync(image, ThumbnailMaxDimension, ct);

            var folder = $"photo-selection/{projectId}";
            var previewUrl = await fileStorage.SaveAsync(new MemoryStream(previewBytes), $"{nextNumber}_preview.jpg", folder, ct);
            var thumbnailUrl = await fileStorage.SaveAsync(new MemoryStream(thumbnailBytes), $"{nextNumber}_thumb.jpg", folder, ct);

            photos.Add(new Photo
            {
                PhotoSelectionProjectId = projectId,
                PhotoNumber = nextNumber,
                OriginalFileName = file.OriginalFileName,
                RelativePath = file.RelativePath,
                ThumbnailPath = thumbnailUrl,
                PreviewPath = previewUrl,
                SelectionType = PhotoSelectionTypes.None,
                IsSelected = false,
                CreatedAt = now,
                UpdatedAt = now
            });
            nextNumber++;
        }

        await photoRepository.AddRangeAsync(photos, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return photos.Select(MapToDto).ToList();
    }

    public async Task<List<PhotoDto>> GetPhotosAsync(int projectId, int? afterPhotoNumber, int limit, CancellationToken ct = default)
    {
        var photos = await photoRepository.SearchAsync(projectId, afterPhotoNumber, limit, ct);
        return photos.Select(MapToDto).ToList();
    }

    public async Task<SetSelectionResult> SetSelectionAsync(int projectId, int photoId, string newSelectionType, CancellationToken ct = default)
    {
        var photo = await photoRepository.GetByIdAsync(projectId, photoId, ct);
        if (photo is null)
        {
            return SetSelectionResult.Fail(SetSelectionFailureReason.PhotoNotFound);
        }

        var project = await projectRepository.GetByIdAsync(projectId, ct)
            ?? throw new InvalidOperationException("Project not found.");

        if (project.Status == PhotoSelectionStatuses.Submitted)
        {
            return SetSelectionResult.Fail(SetSelectionFailureReason.ProjectLocked);
        }

        var oldType = photo.SelectionType;
        if (oldType == newSelectionType)
        {
            return SetSelectionResult.Success(MapToDto(photo));
        }

        // Only re-check the limit when the change would use up more capacity in a bucket —
        // unselecting, or moving into a bucket you're already inside of, never needs a check.
        var increasesUsage = newSelectionType != PhotoSelectionTypes.None;
        if (increasesUsage)
        {
            var (total, normal, big) = await photoRepository.GetCountsAsync(projectId, ct);
            // The photo being changed is already counted in these totals under its OLD type —
            // back it out first so the check reflects the state *after* this one change.
            if (oldType == PhotoSelectionTypes.Normal) normal--;
            if (oldType == PhotoSelectionTypes.Big) big--;
            var selected = normal + big;

            if (project.SelectionLimitTotal is not null && selected + 1 > project.SelectionLimitTotal)
            {
                return SetSelectionResult.Fail(SetSelectionFailureReason.LimitExceeded);
            }
            if (newSelectionType == PhotoSelectionTypes.Normal && project.SelectionLimitNormal is not null && normal + 1 > project.SelectionLimitNormal)
            {
                return SetSelectionResult.Fail(SetSelectionFailureReason.LimitExceeded);
            }
            if (newSelectionType == PhotoSelectionTypes.Big && project.SelectionLimitBig is not null && big + 1 > project.SelectionLimitBig)
            {
                return SetSelectionResult.Fail(SetSelectionFailureReason.LimitExceeded);
            }
        }

        var now = DateTime.UtcNow;
        photo.SelectionType = newSelectionType;
        photo.IsSelected = newSelectionType != PhotoSelectionTypes.None;
        photo.SelectedAt = photo.IsSelected ? now : null;
        photo.UpdatedAt = now;
        photoRepository.Update(photo);

        if (project.SelectionStartedAt is null)
        {
            project.SelectionStartedAt = now;
        }
        if (project.Status == PhotoSelectionStatuses.LinkGenerated)
        {
            project.Status = PhotoSelectionStatuses.InProgress;
        }
        project.UpdatedAt = now;
        projectRepository.Update(project);

        await activityRepository.AddAsync(new PhotoSelectionActivity
        {
            PhotoSelectionProjectId = projectId,
            PhotoId = photoId,
            Action = "SelectionChanged",
            OldSelectionType = oldType,
            NewSelectionType = newSelectionType,
            CreatedAt = now
        }, ct);

        await unitOfWork.SaveChangesAsync(ct);
        return SetSelectionResult.Success(MapToDto(photo));
    }

    private static readonly HashSet<string> LocalPreviewExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"
    };
    private const long MaxLocalPreviewSourceBytes = 30 * 1024 * 1024;
    private const int BrowsePreviewMaxDimension = 200;

    public async Task<byte[]?> GetLocalImagePreviewAsync(string path, CancellationToken ct = default)
    {
        if (!LocalPreviewExtensions.Contains(Path.GetExtension(path)))
        {
            return null;
        }

        var fileInfo = new FileInfo(path);
        if (!fileInfo.Exists || fileInfo.Length > MaxLocalPreviewSourceBytes)
        {
            return null;
        }

        try
        {
            using var image = await Image.LoadAsync(path, ct);
            return await EncodeAsync(image, BrowsePreviewMaxDimension, ct);
        }
        catch (UnknownImageFormatException)
        {
            return null;
        }
    }

    private async Task<byte[]> EncodeAsync(Image image, int maxDimension, CancellationToken ct)
    {
        using var clone = image.CloneAs<SixLabors.ImageSharp.PixelFormats.Rgba32>();
        clone.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(maxDimension, maxDimension) }));

        using var output = new MemoryStream();
        await clone.SaveAsync(output, new JpegEncoder { Quality = JpegQuality }, ct);
        return output.ToArray();
    }

    private static PhotoDto MapToDto(Photo photo) => new()
    {
        PhotoId = photo.PhotoId,
        PhotoNumber = photo.PhotoNumber,
        OriginalFileName = photo.OriginalFileName,
        ThumbnailUrl = photo.ThumbnailPath,
        PreviewUrl = photo.PreviewPath,
        SelectionType = photo.SelectionType
    };
}
