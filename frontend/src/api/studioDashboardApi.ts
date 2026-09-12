import { apiClient } from "./client";
import type { DateRangePreset, StudioDashboardSummary } from "../types/studioDashboard";

export const studioDashboardApi = {
  getSummary: (preset: DateRangePreset, customStart?: string, customEnd?: string) =>
    apiClient
      .get<StudioDashboardSummary>("/api/studio-dashboard/summary", { params: { preset, customStart, customEnd } })
      .then((res) => res.data),
};
