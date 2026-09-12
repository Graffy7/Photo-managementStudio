import { apiClient } from "./client";
import type {
  CompletedEventPhotoSelection,
  CreatePhotoSelectionProjectRequest,
  FolderBrowseResult,
  GenerateLinkRequest,
  GenerateLinkResult,
  Photo,
  PhotoActivity,
  PhotoProcessingJob,
  PhotoSelectionProject,
} from "../types/photoSelection";

export const photoSelectionApi = {
  search: (params: { customerId?: number; eventId?: number }) =>
    apiClient.get<PhotoSelectionProject[]>("/api/photo-selection/projects", { params }).then((res) => res.data),

  getCompletedEvents: () =>
    apiClient.get<CompletedEventPhotoSelection[]>("/api/photo-selection/completed-events").then((res) => res.data),

  getById: (id: number) =>
    apiClient.get<PhotoSelectionProject>(`/api/photo-selection/projects/${id}`).then((res) => res.data),

  create: (request: CreatePhotoSelectionProjectRequest) =>
    apiClient.post<PhotoSelectionProject>("/api/photo-selection/projects", request).then((res) => res.data),

  getPhotos: (id: number, after?: number, limit = 50) =>
    apiClient.get<Photo[]>(`/api/photo-selection/projects/${id}/photos`, { params: { after, limit } }).then((res) => res.data),

  importPhotos: (id: number, files: { uri: string; name: string; type: string }[] | File[]) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file as any);
    }
    return apiClient
      .post<Photo[]>(`/api/photo-selection/projects/${id}/photos`, formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((res) => res.data);
  },

  generateLink: (id: number, request: GenerateLinkRequest) =>
    apiClient.post<GenerateLinkResult>(`/api/photo-selection/projects/${id}/link`, request).then((res) => res.data),

  revokeLink: (id: number) => apiClient.delete(`/api/photo-selection/projects/${id}/link`),

  reopen: (id: number) => apiClient.post(`/api/photo-selection/projects/${id}/reopen`),

  startProcessing: (id: number) =>
    apiClient.post<PhotoProcessingJob>(`/api/photo-selection/projects/${id}/process`).then((res) => res.data),

  getProcessingJob: (id: number, jobId: number) =>
    apiClient.get<PhotoProcessingJob>(`/api/photo-selection/projects/${id}/jobs/${jobId}`).then((res) => res.data),

  getHistory: (id: number) =>
    apiClient.get<PhotoActivity[]>(`/api/photo-selection/projects/${id}/history`).then((res) => res.data),

  getReportUrl: (id: number) => `/api/photo-selection/projects/${id}/report`,

  browseFolders: (path?: string) =>
    apiClient.get<FolderBrowseResult>("/api/photo-selection/browse-folders", { params: path ? { path } : {} }).then((res) => res.data),

  getBrowseFilePreview: (path: string) =>
    apiClient
      .get<ArrayBuffer>("/api/photo-selection/browse-file-preview", { params: { path }, responseType: "arraybuffer" })
      .then((res) => res.data),
};
