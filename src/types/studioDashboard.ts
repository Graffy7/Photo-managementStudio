export const DATE_RANGE_PRESETS = [
  "Today",
  "Yesterday",
  "ThisWeek",
  "PreviousWeek",
  "ThisMonth",
  "PreviousMonth",
  "ThisYear",
  "PreviousYear",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  Today: "Today",
  Yesterday: "Yesterday",
  ThisWeek: "This week",
  PreviousWeek: "Last week",
  ThisMonth: "This month",
  PreviousMonth: "Last month",
  ThisYear: "This year",
  PreviousYear: "Last year",
};

export interface StudioDashboardSummary {
  rangeStart: string;
  rangeEnd: string;

  totalLeads: number;
  newLeads: number;
  convertedLeads: number;
  conversionRate: number;

  totalCustomers: number;

  totalEvents: number;
  upcomingEvents: number;
  completedEvents: number;
  cancelledEvents: number;

  quotationValue: number;
  collectedRevenue: number;
  outstandingBalance: number;
  totalExpenses: number;
  expectedProfit: number;
  cashProfit: number;
}
