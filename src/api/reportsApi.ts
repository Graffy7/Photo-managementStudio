import { apiClient } from "./client";
import type { ProfitReport } from "../types/profitReport";
import type { DateRangePreset } from "../types/studioDashboard";

export const reportsApi = {
  getProfitReport: (preset: DateRangePreset) =>
    apiClient.get<ProfitReport>("/api/reports/profit", { params: { preset } }).then((res) => res.data),
};
