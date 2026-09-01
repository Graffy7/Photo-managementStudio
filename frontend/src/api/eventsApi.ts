import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateEventRequest, StudioEvent, UpdateEventRequest } from "../types/event";

export const eventsApi = {
  search: (params: { search?: string; eventStatus?: string; customerId?: number; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<StudioEvent>>("/api/events", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<StudioEvent>(`/api/events/${id}`).then((res) => res.data),

  create: (request: CreateEventRequest) => apiClient.post<StudioEvent>("/api/events", request).then((res) => res.data),

  update: (id: number, request: UpdateEventRequest) =>
    apiClient.put<StudioEvent>(`/api/events/${id}`, request).then((res) => res.data),
};
