// What to re-load when the server says an area changed on another device (names match
// ChangeAreas on the server). Each entry lists react-query key prefixes; invalidating them
// re-fetches whatever is on screen now and marks the rest stale for when it's next opened.
const DASHBOARD = ["studio-dashboard-summary", "studio-activity"];
const EVENT_VIEWS = ["events", "events-upcoming", "event", "event-history", "event-quote", "customer-events", "day-board", "calendar-month"];

export const AREA_QUERIES: Record<string, string[]> = {
  customers: ["customers", "customers-picker", "customer-events", "events", ...DASHBOARD],
  events: [...EVENT_VIEWS, "event-workers", "photo-gallery-events", ...DASHBOARD],
  payments: ["payments", ...EVENT_VIEWS, "profit-report", ...DASHBOARD],
  quotations: ["quotations", "event-quote", "event-history", "events", "customer-events", "profit-report", ...DASHBOARD],
  workers: ["workers", "workers-active-picker", "event-workers", "events"],
  leads: ["leads", "leads-recent", ...DASHBOARD],
  expenses: ["expenses", "expense-categories", "profit-report", ...DASHBOARD],
  services: ["services", "services-active"],
  photos: ["photo-gallery", "photo-gallery-events", "photo-gallery-photos", "photo-gallery-selected", "gallery-folders"],
  settings: ["studio-profile", "business-settings", "notification-settings", "quotation-settings", "pdf-settings", "form-fields", "lookups"],
  notifications: ["notifications", "notifications-unread-count"],
  subscription: ["my-subscription"],
  modules: ["my-features"],
};
