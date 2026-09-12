import { apiClient } from "./client";
import type { ProfitReport } from "../types/profitReport";
import type { DateRangePreset } from "../types/studioDashboard";

export const reportsApi = {
  getProfitReport: (preset: DateRangePreset, customStart?: string, customEnd?: string) =>
    apiClient
      .get<ProfitReport>("/api/reports/profit", { params: { preset, customStart, customEnd } })
      .then((res) => res.data),
};
