export type EventCategory = "wedding" | "preWedding" | "portrait" | "birthday" | "corporate" | "other";

// Event types are free-text lookups configured per studio, so categorization is keyword-based
// (same pattern as auditTone.ts) rather than a fixed id mapping — order matters: "pre wedding"
// contains "wedding" too, so that check must run first.
export function categorizeEventType(eventTypeName: string | null): EventCategory {
  const name = (eventTypeName ?? "").toLowerCase();

  if (name.includes("pre") && name.includes("wed")) return "preWedding";
  if (name.includes("wedding") || name.includes("engagement")) return "wedding";
  if (name.includes("portrait") || name.includes("headshot") || name.includes("model")) return "portrait";
  if (name.includes("birthday") || name.includes("anniversary")) return "birthday";
  if (name.includes("corporate") || name.includes("business")) return "corporate";
  return "other";
}

export const CATEGORY_ORDER: EventCategory[] = ["wedding", "preWedding", "portrait", "birthday", "corporate", "other"];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  wedding: "Wedding",
  preWedding: "Pre Wedding",
  portrait: "Portrait",
  birthday: "Birthday",
  corporate: "Corporate",
  other: "Other",
};

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  wedding: "#a78bfa",
  preWedding: "#4cc493",
  portrait: "#7fc0e6",
  birthday: "#ff7a72",
  corporate: "#f2bd5c",
  other: "#8a99ad",
};

export const CATEGORY_ICONS: Record<EventCategory, string> = {
  wedding: "heart",
  preWedding: "walk-outline",
  portrait: "camera-outline",
  birthday: "gift-outline",
  corporate: "briefcase-outline",
  other: "ellipsis-horizontal-circle-outline",
};
