export const DATE_RANGE_PRESETS = [
  "Today",
  "Yesterday",
  "ThisWeek",
  "PreviousWeek",
  "ThisMonth",
  "PreviousMonth",
  "ThisYear",
  "PreviousYear",
  "Custom",
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
  Custom: "Custom range",
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

  // null means there's no previous-period baseline to compare against, not that change is zero.
  leadsChangePercent: number | null;
  customersChangePercent: number | null;
  eventsChangePercent: number | null;
  revenueChangePercent: number | null;

  topServices: TopService[];
  revenueTrend: RevenueTrendPoint[];
}

export interface TopService {
  serviceName: string;
  usageCount: number;
  percentage: number;
}

export interface RevenueTrendEvent {
  eventId: number | null;
  eventName: string;
  customerName: string;
  venue: string | null;
  amount: number;
}

export interface RevenueTrendPoint {
  date: string;
  amount: number;
  // Which events that day's revenue came from, largest first.
  events: RevenueTrendEvent[];
}
