import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { CreateEventRequest, EventHistory, StudioEvent, UpdateEventRequest } from "../types/event";
import type { AssignedWorker } from "../types/dayBoard";

export const eventsApi = {
  search: (params: { search?: string; eventStatus?: string; customerId?: number; eventDate?: string; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<StudioEvent>>("/api/events", { params }).then((res) => res.data),

  getById: (id: number) => apiClient.get<StudioEvent>(`/api/events/${id}`).then((res) => res.data),

  history: (id: number) => apiClient.get<EventHistory>(`/api/events/${id}/history`).then((res) => res.data),

  create: (request: CreateEventRequest) => apiClient.post<StudioEvent>("/api/events", request).then((res) => res.data),

  update: (id: number, request: UpdateEventRequest) =>
    apiClient.put<StudioEvent>(`/api/events/${id}`, request).then((res) => res.data),

  updateNotes: (eventId: number, notes: string) =>
    apiClient.patch<StudioEvent>(`/api/events/${eventId}/notes`, { notes: notes || undefined }).then((res) => res.data),

  getAssignedWorkers: (eventId: number) =>
    apiClient.get<AssignedWorker[]>(`/api/events/${eventId}/workers`).then((res) => res.data),

  assignWorker: (eventId: number, workerId: number, notes?: string) =>
    apiClient.post<AssignedWorker>(`/api/events/${eventId}/workers`, { workerId, notes }).then((res) => res.data),

  unassignWorker: (eventId: number, workerId: number) => apiClient.delete(`/api/events/${eventId}/workers/${workerId}`),

  delete: (id: number) => apiClient.delete(`/api/events/${id}`),
};
