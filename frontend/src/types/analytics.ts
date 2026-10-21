export type ReportPreset = "Last7Days" | "Last1Month" | "Last3Months" | "Last6Months" | "Last1Year" | "Custom";

// The range the report is for. customStart/customEnd (yyyy-mm-dd) only with "Custom".
export interface ReportRange {
  preset: ReportPreset;
  customStart?: string;
  customEnd?: string;
}

export interface AnalyticsFigures {
  newBookings: number;
  events: number;
  completed: number;
  cancelled: number;
  pending: number;
  eventValue: number;
  moneyReceived: number;
  expenses: number;
  profit: number;
}

export interface AnalyticsSummary extends AnalyticsFigures {
  customersOwe: number;
  cancelledValue: number;
}

export interface AnalyticsBucket extends AnalyticsFigures {
  start: string;
  lastDay: string;
  label: string;
}

export interface AnalyticsEventType {
  name: string;
  events: number;
  completed: number;
  cancelled: number;
  pending: number;
  eventValue: number;
  received: number;
}

export interface AnalyticsReport {
  rangeStart: string;
  rangeLastDay: string;
  grouping: "Day" | "Month";
  summary: AnalyticsSummary;
  buckets: AnalyticsBucket[];
  eventTypes: AnalyticsEventType[];
  statuses: { status: string; count: number }[];
  insights: string[];
  profit: import("./profitReport").ProfitReport;
}
