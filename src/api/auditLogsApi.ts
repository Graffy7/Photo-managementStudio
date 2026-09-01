import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type { AuditLogEntry } from "../types/auditLog";

export const auditLogsApi = {
  search: (params: { studioId?: number; page?: number; pageSize?: number }) =>
    apiClient.get<PagedResult<AuditLogEntry>>("/api/audit-logs", { params }).then((res) => res.data),
};
