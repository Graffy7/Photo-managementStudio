import { apiClient } from "./client";
import type { CreateLookupRequest, Lookup, UpdateLookupRequest } from "../types/lookup";

function createLookupApi(basePath: string) {
  return {
    getAll: () => apiClient.get<Lookup[]>(basePath).then((res) => res.data),
    create: (request: CreateLookupRequest) => apiClient.post<Lookup>(basePath, request).then((res) => res.data),
    update: (id: number, request: UpdateLookupRequest) =>
      apiClient.put<Lookup>(`${basePath}/${id}`, request).then((res) => res.data),
    remove: (id: number) => apiClient.delete(`${basePath}/${id}`),
  };
}

export const lookupApis = {
  eventTypes: createLookupApi("/api/event-types"),
  leadSources: createLookupApi("/api/lead-sources"),
  leadStatuses: createLookupApi("/api/lead-statuses"),
  workerTypes: createLookupApi("/api/worker-types"),
};

export type LookupKind = keyof typeof lookupApis;
