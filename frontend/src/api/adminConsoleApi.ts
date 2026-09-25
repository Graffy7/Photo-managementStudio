import { apiClient } from "./client";
import type { PagedResult } from "../types/studio";
import type {
  AdminActivity, AdminOverview, LedgerPage, AdminStudioDetail, AdminStudioRow, AdminStudioUsage, AdminSubscription, ManualPaymentRequest,
} from "../types/adminConsole";

// The platform admin's console (api/admin). Studio edits, block/unblock and module switches keep
// their own endpoints in studiosApi / featuresApi.
export const adminConsoleApi = {
  overview: (params: { from?: string; to?: string }) =>
    apiClient.get<AdminOverview>("/api/admin/overview", { params }).then((r) => r.data),

  studios: (params: { search?: string; status?: string; plan?: string; sort?: string; page: number; pageSize: number }) =>
    apiClient.get<PagedResult<AdminStudioRow>>("/api/admin/studios", { params }).then((r) => r.data),

  studio: (id: number) => apiClient.get<AdminStudioDetail>(`/api/admin/studios/${id}`).then((r) => r.data),

  usage: (id: number, params: { from?: string; to?: string; refresh?: boolean }) =>
    apiClient.get<AdminStudioUsage>(`/api/admin/studios/${id}/usage`, { params }).then((r) => r.data),

  subscription: (id: number) => apiClient.get<AdminSubscription>(`/api/admin/studios/${id}/subscription`).then((r) => r.data),

  activity: (params: { studioId?: number; from?: string; to?: string; module?: string; search?: string; page: number; pageSize: number }) =>
    apiClient.get<PagedResult<AdminActivity>>("/api/admin/activity", { params }).then((r) => r.data),

  activityModules: (studioId?: number) =>
    apiClient.get<string[]>("/api/admin/activity/modules", { params: { studioId } }).then((r) => r.data),

  startTrial: (id: number, days: number) => apiClient.post(`/api/admin/studios/${id}/trial/start`, { days }).then(() => undefined),
  extendTrial: (id: number, days: number) => apiClient.post(`/api/admin/studios/${id}/trial/extend`, { days }).then(() => undefined),
  endTrial: (id: number) => apiClient.post(`/api/admin/studios/${id}/trial/end`).then(() => undefined),

  payments: (params: { studioId?: number; search?: string; status?: string; kind?: string; from?: string; to?: string; page: number; pageSize: number }) =>
    apiClient.get<LedgerPage>("/api/admin/payments", { params }).then((r) => r.data),

  extendSubscription: (id: number, days: number) =>
    apiClient.post(`/api/admin/studios/${id}/subscription/extend`, { days }).then(() => undefined),
  expireSubscription: (id: number) => apiClient.post(`/api/admin/studios/${id}/subscription/expire`).then(() => undefined),

  setAccess: (id: number, mode: "Auto" | "Full" | "ReadOnly" | "Suspended") =>
    apiClient.put(`/api/admin/studios/${id}/access`, { mode }).then(() => undefined),
  changePlan: (id: number, planId: number) =>
    apiClient.put(`/api/admin/studios/${id}/subscription/plan`, { planId }).then(() => undefined),

  recordPayment: (id: number, request: ManualPaymentRequest) =>
    apiClient.post(`/api/admin/studios/${id}/payments`, request).then(() => undefined),
};
