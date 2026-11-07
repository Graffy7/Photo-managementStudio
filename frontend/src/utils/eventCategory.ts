export type EventCategory = "wedding" | "reception" | "preWedding" | "portrait" | "birthday" | "corporate" | "other";

// Event types are free-text lookups configured per studio, so categorization is keyword-based
// (same pattern as auditTone.ts) rather than a fixed id mapping — order matters: "pre wedding"
// contains "wedding" too, so that check must run first.
export function categorizeEventType(eventTypeName: string | null): EventCategory {
  const name = (eventTypeName ?? "").toLowerCase();

  if (name.includes("pre") && name.includes("wed")) return "preWedding";
  if (name.includes("reception")) return "reception";
  if (name.includes("wedding") || name.includes("engagement")) return "wedding";
  if (name.includes("portrait") || name.includes("headshot") || name.includes("model") || name.includes("shoot") || name.includes("photo")) return "portrait";
  if (name.includes("birthday") || name.includes("anniversary")) return "birthday";
  if (name.includes("corporate") || name.includes("business")) return "corporate";
  return "other";
}

export const CATEGORY_ORDER: EventCategory[] = ["wedding", "reception", "preWedding", "portrait", "birthday", "corporate", "other"];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  wedding: "Wedding",
  reception: "Reception",
  preWedding: "Pre Wedding",
  portrait: "Photoshoot",
  birthday: "Birthday",
  corporate: "Corporate",
  other: "Other",
};

// Bright on navy and clearly different from each other (they appear side by side in the calendar).
export const CATEGORY_COLORS: Record<EventCategory, string> = {
  wedding: "#FF9F1C",
  reception: "#8B6CFF",
  preWedding: "#FF5FA2",
  portrait: "#22B8CF",
  birthday: "#22C58B",
  corporate: "#F2D24B",
  other: "#94A3C8",
};

export const CATEGORY_ICONS: Record<EventCategory, string> = {
  wedding: "heart",
  reception: "wine-outline",
  preWedding: "walk-outline",
  portrait: "camera-outline",
  birthday: "gift-outline",
  corporate: "briefcase-outline",
  other: "ellipsis-horizontal-circle-outline",
};
