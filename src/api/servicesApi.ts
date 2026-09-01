import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateServiceRequest, StudioService, UpdateServiceRequest } from "../types/service";

export const servicesApi = {
  search: (params: { search?: string; isActive?: boolean; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<StudioService>>("/api/services", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<StudioService>(`/api/services/${id}`).then((res) => res.data),

  create: (request: CreateServiceRequest) =>
    apiClient.post<StudioService>("/api/services", request).then((res) => res.data),

  update: (id: number, request: UpdateServiceRequest) =>
    apiClient.put<StudioService>(`/api/services/${id}`, request).then((res) => res.data),

  activate: (id: number) => apiClient.post<StudioService>(`/api/services/${id}/activate`).then((res) => res.data),
  deactivate: (id: number) => apiClient.post<StudioService>(`/api/services/${id}/deactivate`).then((res) => res.data),
};
