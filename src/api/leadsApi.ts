import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateLeadRequest, Lead, UpdateLeadRequest } from "../types/lead";

export const leadsApi = {
  search: (params: { search?: string; leadStatusId?: number; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Lead>>("/api/leads", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Lead>(`/api/leads/${id}`).then((res) => res.data),

  create: (request: CreateLeadRequest) => apiClient.post<Lead>("/api/leads", request).then((res) => res.data),

  update: (id: number, request: UpdateLeadRequest) =>
    apiClient.put<Lead>(`/api/leads/${id}`, request).then((res) => res.data),

  remove: (id: number) => apiClient.delete(`/api/leads/${id}`),

  convert: (id: number) => apiClient.post<Lead>(`/api/leads/${id}/convert`).then((res) => res.data),
};
