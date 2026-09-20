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
