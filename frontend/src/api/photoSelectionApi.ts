import axios from "axios";
import { Platform } from "react-native";
import { apiClient } from "./client";
import { API_BASE_URL } from "../constants/config";
import type { PagedResult } from "../types/studio";
import type {
  CompletedEventGallery,
  CopyJob,
  FolderBrowseResult,
  GalleryCounts,
  GenerateLinkResult,
  ImportJob,
  OwnerGallery,
  OwnerPhotosPage,
  PhotoFilter,
  PhotoFolder,
  PublicGallery,
  PublicPhotosPage,
  PublicSelectionResult,
  SelectionType,
  ShareMessage,
  SubmitResult,
} from "../types/photoSelection";

// ---- Studio owner (authenticated)

export const photoSelectionApi = {
  completedEvents: (params: { search?: string; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<CompletedEventGallery>>("/api/photo-galleries/completed-events", { params }).then((r) => r.data),

  openForEvent: (eventId: number) =>
    apiClient.post<OwnerGallery>(`/api/photo-galleries/events/${eventId}`).then((r) => r.data),

  get: (galleryId: number) =>
    apiClient.get<OwnerGallery>(`/api/photo-galleries/${galleryId}`).then((r) => r.data),

  browseFolders: (path?: string) =>
    apiClient.get<FolderBrowseResult>("/api/photo-galleries/browse-folders", { params: { path } }).then((r) => r.data),

  startImport: (galleryId: number, sourceFolder: string) =>
    apiClient.post<ImportJob>(`/api/photo-galleries/${galleryId}/import`, { sourceFolder }).then((r) => r.data),

  removeImportedFolder: (galleryId: number, sourceFolder: string) =>
    apiClient
      .post<{ removedCount: number; selectedRemovedCount: number }>(`/api/photo-galleries/${galleryId}/imported-folders/remove`, { sourceFolder })
      .then((r) => r.data),

  rebuildPreviews: (galleryId: number) =>
    apiClient.post<ImportJob>(`/api/photo-galleries/${galleryId}/rebuild-previews`).then((r) => r.data),

  getImportJob: (galleryId: number, jobId: number) =>
    apiClient.get<ImportJob>(`/api/photo-galleries/${galleryId}/import/${jobId}`).then((r) => r.data),

  startSelectionCopy: (galleryId: number) =>
    apiClient.post<CopyJob>(`/api/photo-galleries/${galleryId}/selection-copy`).then((r) => r.data),

  generateLink: (galleryId: number, expiresInDays: number) =>
    apiClient.post<GenerateLinkResult>(`/api/photo-galleries/${galleryId}/link`, { expiresInDays }).then((r) => r.data),

  revokeLink: (galleryId: number) => apiClient.delete(`/api/photo-galleries/${galleryId}/link`).then(() => undefined),

  lock: (galleryId: number) => apiClient.post(`/api/photo-galleries/${galleryId}/lock`).then(() => undefined),
  unlock: (galleryId: number) => apiClient.post(`/api/photo-galleries/${galleryId}/unlock`).then(() => undefined),

  folders: (galleryId: number) =>
    apiClient.get<PhotoFolder[]>(`/api/photo-galleries/${galleryId}/folders`).then((r) => r.data),

  createFolder: (galleryId: number, name: string) =>
    apiClient.post<PhotoFolder>(`/api/photo-galleries/${galleryId}/folders`, { name }).then((r) => r.data),

  renameFolder: (galleryId: number, folderId: number, name: string) =>
    apiClient.put<PhotoFolder>(`/api/photo-galleries/${galleryId}/folders/${folderId}`, { name }).then((r) => r.data),

  setFolderDelivered: (galleryId: number, folderId: number, isDelivered: boolean) =>
    apiClient.post<PhotoFolder>(`/api/photo-galleries/${galleryId}/folders/${folderId}/delivered`, { isDelivered }).then((r) => r.data),

  deleteFolder: (galleryId: number, folderId: number) =>
    apiClient.delete(`/api/photo-galleries/${galleryId}/folders/${folderId}`).then(() => undefined),

  photos: (galleryId: number, params: { filter?: PhotoFilter; search?: string; page?: number; pageSize?: number; folderId?: number }) =>
    apiClient.get<OwnerPhotosPage>(`/api/photo-galleries/${galleryId}/photos`, { params }).then((r) => r.data),

  shareMessage: (galleryId: number, reminder: boolean) =>
    apiClient
      .get<ShareMessage>(`/api/photo-galleries/${galleryId}/share-message`, { params: { baseUrl: publicBaseUrl(), reminder } })
      .then((r) => r.data),

  exportCsv: (galleryId: number) =>
    apiClient.get<ArrayBuffer>(`/api/photo-galleries/${galleryId}/export`, { responseType: "arraybuffer" }).then((r) => r.data),
};

// The page the customer opens is served by this same web app, so the link is built from where the
// owner is browsing (a native build has no origin — set EXPO_PUBLIC_PUBLIC_BASE_URL there).
export function publicBaseUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return process.env.EXPO_PUBLIC_PUBLIC_BASE_URL ?? API_BASE_URL;
}

export function buildCustomerLink(token: string): string {
  return `${publicBaseUrl()}/photo-selection/${token}`;
}

// Preview/thumbnail URLs come back as "/uploads/..." — served by the API host.
export function photoUrl(path: string | null | undefined): string | undefined {
  return path ? `${API_BASE_URL}${path}` : undefined;
}

// ---- Customer (public, token in the URL, no login)

const publicClient = axios.create({ baseURL: API_BASE_URL });

export type PublicFailure = "invalid" | "expired" | "locked" | "offline" | "error";

export interface PublicError {
  kind: PublicFailure;
  message: string;
}

export const OFFLINE_MESSAGE = "Unable to save this selection. Please check your internet connection.";

// Turns any failed public call into something the page can word: a dead link, an expired one, a
// locked selection, no connection, or a generic failure.
export function toPublicError(err: unknown): PublicError {
  if (axios.isAxiosError(err)) {
    if (!err.response) return { kind: "offline", message: OFFLINE_MESSAGE };
    const data = err.response.data as { code?: string; message?: string } | undefined;
    const message = data?.message ?? "Something went wrong. Please try again.";
    if (err.response.status === 410 || data?.code === "expired") return { kind: "expired", message };
    if (err.response.status === 404 && data?.code === "invalid") return { kind: "invalid", message };
    if (data?.code === "locked") return { kind: "locked", message };
    return { kind: "error", message };
  }
  return { kind: "error", message: "Something went wrong. Please try again." };
}

export const publicPhotoSelectionApi = {
  get: (token: string) =>
    publicClient.get<PublicGallery>(`/api/public/photo-selection/${token}`).then((r) => r.data),

  folders: (token: string) =>
    publicClient.get<PhotoFolder[]>(`/api/public/photo-selection/${token}/folders`).then((r) => r.data),

  photos: (token: string, params: { filter?: PhotoFilter; search?: string; page?: number; pageSize?: number; folderId?: number }) =>
    publicClient.get<PublicPhotosPage>(`/api/public/photo-selection/${token}/photos`, { params }).then((r) => r.data),

  summary: (token: string) =>
    publicClient.get<GalleryCounts>(`/api/public/photo-selection/${token}/summary`).then((r) => r.data),

  select: (token: string, photoId: number, selectionType: SelectionType) =>
    publicClient
      .put<PublicSelectionResult>(`/api/public/photo-selection/${token}/photos/${photoId}`, { selectionType })
      .then((r) => r.data),

  unselect: (token: string, photoId: number) =>
    publicClient.delete<PublicSelectionResult>(`/api/public/photo-selection/${token}/photos/${photoId}`).then((r) => r.data),

  submit: (token: string) =>
    publicClient.post<SubmitResult>(`/api/public/photo-selection/${token}/submit`).then((r) => r.data),
};
