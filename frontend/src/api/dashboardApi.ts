import { apiClient } from "./client";
import type { DashboardSummary } from "../types/dashboard";

export const dashboardApi = {
  getSummary: () => apiClient.get<DashboardSummary>("/api/dashboard/summary").then((res) => res.data),
};
