import { apiClient } from "./client";
import type { ProfitReport } from "../types/profitReport";
import type { DateRangePreset } from "../types/studioDashboard";
import type { AnalyticsReport, ReportRange } from "../types/analytics";

const rangeParams = (r: ReportRange) => ({
  preset: r.preset,
  customStart: r.preset === "Custom" ? r.customStart : undefined,
  customEnd: r.preset === "Custom" ? r.customEnd : undefined,
});

export const reportsApi = {
  getProfitReport: (preset: DateRangePreset, customStart?: string, customEnd?: string) =>
    apiClient
      .get<ProfitReport>("/api/reports/profit", { params: { preset, customStart, customEnd } })
      .then((res) => res.data),

  // signal: a newer range cancels the request for the old one, so an old answer never lands last.
  getAnalytics: (range: ReportRange, signal?: AbortSignal) =>
    apiClient
      .get<AnalyticsReport>("/api/reports/analytics", { params: rangeParams(range), signal })
      .then((res) => res.data),

  // details: false = the one-page visual summary; true = followed by the detailed tables.
  exportAnalytics: (range: ReportRange, details = false) =>
    apiClient
      .get<ArrayBuffer>("/api/reports/analytics/export", { params: { ...rangeParams(range), details }, responseType: "arraybuffer" })
      .then((res) => res.data),
};
