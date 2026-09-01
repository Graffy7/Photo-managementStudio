import { apiClient } from "./client";
import type { CreateStudioRequest, PagedResult, Studio, UpdateStudioRequest } from "../types/studio";

export const studiosApi = {
  search: (params: { search?: string; isActive?: boolean; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Studio>>("/api/studios", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Studio>(`/api/studios/${id}`).then((res) => res.data),

  create: (request: CreateStudioRequest) =>
    apiClient.post<Studio>("/api/studios", request).then((res) => res.data),

  update: (id: number, request: UpdateStudioRequest) =>
    apiClient.put<Studio>(`/api/studios/${id}`, request).then((res) => res.data),

  activate: (id: number) => apiClient.post<Studio>(`/api/studios/${id}/activate`).then((res) => res.data),
  deactivate: (id: number) => apiClient.post<Studio>(`/api/studios/${id}/deactivate`).then((res) => res.data),
  block: (id: number) => apiClient.post<Studio>(`/api/studios/${id}/block`).then((res) => res.data),
  unblock: (id: number) => apiClient.post<Studio>(`/api/studios/${id}/unblock`).then((res) => res.data),
};
