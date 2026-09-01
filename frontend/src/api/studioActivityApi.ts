import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { AuditLogEntry } from "../types/auditLog";

export const studioActivityApi = {
  search: (params: { page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<AuditLogEntry>>("/api/studio-activity", { params }).then((res) => res.data),
};
