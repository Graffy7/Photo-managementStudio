export type GalleryState = "NoPhotos" | "NeedToSend" | "Pending" | "Submitted" | "Locked" | "Expired";

export type PhotoFilter = "All" | "Selected" | "NotSelected" | "Normal" | "Big";

// 1 = Normal, 2 = Big (matches SelectionTypes on the server).
export type SelectionType = 1 | 2;

export const SELECTION_LABELS: Record<SelectionType, string> = { 1: "Normal", 2: "Big" };

export interface GalleryCounts {
  total: number;
  selected: number;
  normal: number;
  big: number;
  notSelected: number;
}

export interface ImportJob {
  jobId: number;
  status: "Queued" | "Running" | "Completed" | "CompletedWithErrors" | "Failed";
  totalCount: number;
  processedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OwnerGallery {
  galleryId: number;
  eventId: number;
  customerId: number;
  customerName: string;
  customerMobileNumber: string | null;
  eventTypeName: string | null;
  eventDate: string;
  venue: string | null;
  sourceFolder: string | null;
  state: GalleryState;
  status: "Open" | "Locked";
  isLocked: boolean;
  hasActiveLink: boolean;
  isExpired: boolean;
  linkToken: string | null;
  expiresAt: string | null;
  linkGeneratedAt: string | null;
  firstOpenedAt: string | null;
  lastSelectionAt: string | null;
  submittedAt: string | null;
  changedSinceSubmit: boolean;
  previewsPurged: boolean;
  counts: GalleryCounts;
  latestImport: ImportJob | null;
  selectionFolder: string | null;
  selectionCreatedAt: string | null;
  selectionSyncedAt: string | null;
  selectionOutOfSync: boolean;
  latestCopyJob: CopyJob | null;
}

export interface CompletedEventGallery {
  eventId: number;
  eventDate: string;
  eventTypeName: string | null;
  venue: string | null;
  customerId: number;
  customerName: string;
  galleryId: number | null;
  state: GalleryState;
  photoCount: number;
  selectedCount: number;
  submittedAt: string | null;
}

// A delivery folder. FolderId 0 is the "Other" bucket the server adds for photos that were never
// filed into a folder - it can't be renamed or removed.
export interface PhotoFolder {
  folderId: number;
  name: string;
  sortOrder: number;
  photoCount: number;
  selectedCount: number;
  isDelivered: boolean;
  deliveredAt: string | null;
}

export interface OwnerPhoto {
  photoId: number;
  photoNumber: number;
  fileName: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  width: number;
  height: number;
  selectionType: "Normal" | "Big" | null;
  selectedAt: string | null;
  folderId: number | null;
}

export interface OwnerPhotosPage {
  items: OwnerPhoto[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface GenerateLinkResult {
  token: string;
  expiresAt: string;
}

export interface ShareMessage {
  message: string;
  phoneNumber: string | null;
  whatsAppUrl: string;
}

export interface FolderBrowseResult {
  currentPath: string | null;
  parentPath: string | null;
  folders: { name: string; fullPath: string }[];
  imageCount: number;
}

// ---- Customer (public) shapes

export interface PublicGallery {
  studioName: string;
  title: string;
  customerName: string;
  eventDate: string;
  isLocked: boolean;
  isSubmitted: boolean;
  submittedAt: string | null;
  changedSinceSubmit: boolean;
  expiresAt: string | null;
  counts: GalleryCounts;
}

export interface PublicPhoto {
  photoId: number;
  photoNumber: number;
  fileName: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  width: number;
  height: number;
  selectionType: SelectionType | null;
  folderId: number | null;
}

export interface PublicPhotosPage {
  items: PublicPhoto[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PublicSelectionResult {
  photo: PublicPhoto;
  counts: GalleryCounts;
}

export interface SubmitResult {
  submittedAt: string;
  alreadySubmitted: boolean;
  counts: GalleryCounts;
}

// "Create Selected Photos" / "Sync Selected Photos" — copies the chosen originals into
// <original folder>\Customer Selection\Normal and \Big Size.
export interface CopyJob {
  jobId: number;
  kind: "Create" | "Sync";
  status: "Queued" | "Running" | "Completed" | "CompletedWithErrors" | "Failed";
  totalCount: number;
  normalCount: number;
  bigCount: number;
  processedCount: number;
  createdCount: number;
  existsCount: number;
  removedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
