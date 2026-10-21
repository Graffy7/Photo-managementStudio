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
  "Last7Days",
  "Last1Month",
  "Last3Months",
  "Last6Months",
  "Last1Year",
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
  Last7Days: "Last 7 days",
  Last1Month: "Last 1 month",
  Last3Months: "Last 3 months",
  Last6Months: "Last 6 months",
  Last1Year: "Last 1 year",
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
  ongoingEvents: number;
  completedEvents: number;
  cancelledEvents: number;

  quotationValue: number;
  collectedRevenue: number;
  outstandingBalance: number;
  totalExpenses: number;
  paidExpenses: number;
  pendingExpenses: number;
  expectedProfit: number;
  cashProfit: number;

  // null means there's no previous-period baseline to compare against, not that change is zero.
  leadsChangePercent: number | null;
  customersChangePercent: number | null;
  eventsChangePercent: number | null;
  revenueChangePercent: number | null;

  // Agreed prices of the range's events added up (cancelled left out).
  totalEventValue: number;
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
  // Events that day beyond the ones listed (the tooltip shows "and N more").
  moreEvents?: number;
}
