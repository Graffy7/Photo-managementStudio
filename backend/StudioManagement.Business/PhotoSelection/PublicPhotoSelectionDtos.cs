namespace StudioManagement.Business.PhotoSelection;

// Everything a customer's browser sees — deliberately thin: no studio/customer id, no original
// filenames or local paths, just what's needed to browse and select photos.
public class PublicProjectSummaryDto
{
    public string ProjectName { get; set; } = null!;
    public string Status { get; set; } = null!;
    public bool RequiresPin { get; set; }
    public bool IsSubmitted { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public int? SelectionLimitTotal { get; set; }
    public int? SelectionLimitNormal { get; set; }
    public int? SelectionLimitBig { get; set; }

    public int TotalPhotos { get; set; }
    public int SelectedCount { get; set; }
    public int NormalCount { get; set; }
    public int BigCount { get; set; }
}

public class PublicPhotoDto
{
    public int PhotoId { get; set; }
    public int PhotoNumber { get; set; }
    public string ThumbnailUrl { get; set; } = null!;
    public string PreviewUrl { get; set; } = null!;
    public string SelectionType { get; set; } = null!;
}

public class UnlockRequestDto
{
    public string Pin { get; set; } = null!;
}

public class SetSelectionRequestDto
{
    public string SelectionType { get; set; } = null!;
}

public class SubmitResultDto
{
    public DateTime SubmittedAt { get; set; }
    public int TotalSelected { get; set; }
    public int Normal { get; set; }
    public int Big { get; set; }
}
