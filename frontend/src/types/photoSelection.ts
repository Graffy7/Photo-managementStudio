export const PHOTO_SELECTION_STATUSES = ["Draft", "LinkGenerated", "InProgress", "Submitted", "Reopened", "Processed"] as const;
export type PhotoSelectionStatus = (typeof PHOTO_SELECTION_STATUSES)[number];

export const PHOTO_SELECTION_TYPES = ["None", "Normal", "Big"] as const;
export type PhotoSelectionType = (typeof PHOTO_SELECTION_TYPES)[number];

export const PHOTO_PROCESSING_JOB_STATUSES = ["Pending", "Running", "Completed", "CompletedWithErrors", "Failed"] as const;
export type PhotoProcessingJobStatus = (typeof PHOTO_PROCESSING_JOB_STATUSES)[number];

export interface PhotoSelectionProject {
  photoSelectionProjectId: number;
  customerId: number;
  customerName: string;
  eventId: number | null;
  eventVenue: string | null;
  name: string;
  sourceFolder: string;
  destinationRootFolder: string | null;
  status: PhotoSelectionStatus;

  selectionLimitTotal: number | null;
  selectionLimitNormal: number | null;
  selectionLimitBig: number | null;

  isActive: boolean;
  hasLink: boolean;
  hasPin: boolean;
  tokenExpiresAt: string | null;

  linkGeneratedAt: string | null;
  firstOpenedAt: string | null;
  selectionStartedAt: string | null;
  submittedAt: string | null;
  reopenedAt: string | null;
  processedAt: string | null;
  createdAt: string;

  totalPhotos: number;
  selectedCount: number;
  normalCount: number;
  bigCount: number;
}

export interface CreatePhotoSelectionProjectRequest {
  customerId: number;
  eventId?: number;
  name: string;
  sourceFolder: string;
  destinationRootFolder?: string;
  selectionLimitTotal?: number;
  selectionLimitNormal?: number;
  selectionLimitBig?: number;
}

export interface GenerateLinkRequest {
  expiresInDays?: number;
  pin?: string;
}

export interface GenerateLinkResult {
  token: string;
  tokenExpiresAt: string | null;
}

export interface CompletedEventPhotoSelection {
  eventId: number;
  eventDate: string;
  venue: string | null;
  customerId: number;
  customerName: string;
  photoSelectionProjectId: number | null;
  status: PhotoSelectionStatus | null;
}

export interface FolderBrowseEntry {
  name: string;
  fullPath: string;
}

export interface FolderBrowseFileEntry {
  name: string;
  fullPath: string;
  isImage: boolean;
}

export interface FolderBrowseResult {
  currentPath: string | null;
  parentPath: string | null;
  folders: FolderBrowseEntry[];
  files: FolderBrowseFileEntry[];
}

export interface Photo {
  photoId: number;
  photoNumber: number;
  originalFileName: string;
  thumbnailUrl: string;
  previewUrl: string;
  selectionType: PhotoSelectionType;
}

export interface PhotoActivity {
  action: string;
  photoNumber: number | null;
  oldSelectionType: string | null;
  newSelectionType: string | null;
  createdAt: string;
}

export interface PhotoProcessingJobItem {
  photoNumber: number;
  originalFileName: string;
  result: "Copied" | "Missing" | "Failed";
  errorMessage: string | null;
}

export interface PhotoProcessingJob {
  photoProcessingJobId: number;
  status: PhotoProcessingJobStatus;
  totalCount: number;
  completedCount: number;
  missingCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  items: PhotoProcessingJobItem[];
}

// Public/customer-facing shapes — deliberately thinner, no local-path/original-filename fields.
export interface PublicProjectSummary {
  projectName: string;
  status: PhotoSelectionStatus;
  requiresPin: boolean;
  isSubmitted: boolean;
  submittedAt: string | null;
  selectionLimitTotal: number | null;
  selectionLimitNormal: number | null;
  selectionLimitBig: number | null;
  totalPhotos: number;
  selectedCount: number;
  normalCount: number;
  bigCount: number;
}

export interface PublicPhoto {
  photoId: number;
  photoNumber: number;
  thumbnailUrl: string;
  previewUrl: string;
  selectionType: PhotoSelectionType;
}

export interface SubmitResult {
  submittedAt: string;
  totalSelected: number;
  normal: number;
  big: number;
}
