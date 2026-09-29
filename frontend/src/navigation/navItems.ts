import type { Ionicons } from "@expo/vector-icons";

export interface NavItem {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// The whole app menu, grouped the way a studio works. The desktop sidebar and the phone "More"
// sheet both read this list, so they always match.
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Work",
    items: [
      { route: "Home", label: "Dashboard", icon: "grid-outline" },
      { route: "Calendar", label: "Calendar", icon: "calendar-number-outline" },
      { route: "DayBoard", label: "Day board", icon: "today-outline" },
    ],
  },
  {
    title: "Clients",
    items: [
      { route: "Leads", label: "Enquiries", icon: "person-add-outline" },
      { route: "Customers", label: "Customers", icon: "people-outline" },
      { route: "Events", label: "Events", icon: "calendar-outline" },
      { route: "Quotations", label: "Quotations", icon: "document-text-outline" },
    ],
  },
  {
    title: "Photos",
    items: [{ route: "PhotoSelection", label: "Photo delivery", icon: "images-outline" }],
  },
  {
    title: "Money",
    items: [
      { route: "Payments", label: "Payments", icon: "cash-outline" },
      { route: "Expenses", label: "Expenses", icon: "receipt-outline" },
      { route: "Reports", label: "Reports", icon: "bar-chart-outline" },
    ],
  },
  {
    title: "Studio",
    items: [
      { route: "Workers", label: "Workers", icon: "briefcase-outline" },
      { route: "Services", label: "Services", icon: "pricetags-outline" },
      { route: "Notifications", label: "Notifications", icon: "notifications-outline" },
      { route: "Settings", label: "Settings", icon: "settings-outline" },
      { route: "Subscription", label: "Subscription", icon: "card-outline" },
    ],
  },
];

// Phone bottom bar: the four places used most, plus "More" for everything else.
export const BOTTOM_TABS: NavItem[] = [
  { route: "Home", label: "Home", icon: "grid-outline" },
  { route: "Events", label: "Events", icon: "calendar-outline" },
  { route: "Customers", label: "Customers", icon: "people-outline" },
  { route: "Payments", label: "Payments", icon: "cash-outline" },
];
