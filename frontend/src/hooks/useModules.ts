import { useQuery } from "@tanstack/react-query";
import { featuresApi } from "../api/featuresApi";
import { useAuthStore } from "../auth/authStore";

// Which modules the platform admin has switched on for this studio. While the list is loading
// (or if it can't be read) everything counts as on, so a slow request never hides the app; the
// server still refuses a module that is off.
export function useModules() {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.userType === "STUDIO_OWNER";
  const { data } = useQuery({
    // Per studio, so signing in as another studio in the same tab never shows the last one's list.
    queryKey: ["my-features", user?.studioId],
    queryFn: featuresApi.getMyFeatures,
    enabled: isOwner,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  return (code: string) => data?.[code] ?? true;
}

// Sidebar routes and the module each belongs to.
export const ROUTE_MODULES: Record<string, string> = {
  Home: "DASHBOARD",
  Calendar: "EVENTS",
  Leads: "LEADS",
  Customers: "CUSTOMERS",
  Events: "EVENTS",
  PhotoSelection: "PHOTO_SELECTION",
  Workers: "WORKERS",
  Services: "SERVICES",
  Quotations: "QUOTATIONS",
  Payments: "PAYMENTS",
  Expenses: "EXPENSES",
  Reports: "REPORTS",
  DayBoard: "DAY_BOARD",
  Notifications: "NOTIFICATIONS",
  Settings: "SETTINGS",
};
