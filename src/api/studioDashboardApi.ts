import { apiClient } from "./client";
import type { DateRangePreset, StudioDashboardSummary } from "../types/studioDashboard";

export const studioDashboardApi = {
  getSummary: (preset: DateRangePreset) =>
    apiClient
      .get<StudioDashboardSummary>("/api/studio-dashboard/summary", { params: { preset } })
      .then((res) => res.data),
};
