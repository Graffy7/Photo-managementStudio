// Date-range buttons shared by list pages (Enquiries, Photo delivery). "Custom range" lets the owner
// pick the two dates themselves.
export type Period = "all" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";
export const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "thisWeek", label: "This week" },
  { value: "lastWeek", label: "Last week" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// First and last day (both included) of a period, on this device's calendar.
export function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  // Weeks run Monday to Sunday, as everywhere else in the app.
  const monday = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7));
  const week = (offset: number) => ({
    from: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7 * offset)),
    to: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7 * offset + 6)),
  });
  switch (period) {
    case "thisWeek": return week(0);
    case "lastWeek": return week(-1);
    case "thisMonth": return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case "lastMonth": return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    default: return { from: "", to: "" };
  }
}
