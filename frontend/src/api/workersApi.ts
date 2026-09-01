import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateWorkerRequest, UpdateWorkerRequest, Worker } from "../types/worker";

export const workersApi = {
  search: (params: { search?: string; workerTypeId?: number; isActive?: boolean; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<Worker>>("/api/workers", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<Worker>(`/api/workers/${id}`).then((res) => res.data),

  create: (request: CreateWorkerRequest) => apiClient.post<Worker>("/api/workers", request).then((res) => res.data),

  update: (id: number, request: UpdateWorkerRequest) =>
    apiClient.put<Worker>(`/api/workers/${id}`, request).then((res) => res.data),

  activate: (id: number) => apiClient.post<Worker>(`/api/workers/${id}/activate`).then((res) => res.data),
  deactivate: (id: number) => apiClient.post<Worker>(`/api/workers/${id}/deactivate`).then((res) => res.data),
};
