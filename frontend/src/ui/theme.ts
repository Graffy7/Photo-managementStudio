import { Platform } from "react-native";

// Studio OS design tokens - the one place colours, spacing, sizes and type live. Screens import
// these instead of repeating hex values, so the whole app stays consistent and can be tuned here.

export const colors = {
  // Surfaces: a soft lavender page with white cards and bars (Clean Light Theme)
  page: "#F7F7FF",
  bar: "#FFFFFF", // sidebar, top/bottom bars
  card: "#FFFFFF",
  cardRaised: "#F5F3FF", // hover / pressed / inputs on a card
  border: "#E7E9F5",
  borderStrong: "#D9DBEC",

  // Text
  text: "#17172F",
  textMuted: "#74758C",
  textFaint: "#8A8BA3",

  // The one brand colour: main actions and "you are here"
  primary: "#6D4AFF",
  primaryHover: "#5835E8",
  onPrimary: "#FFFFFF",
  primarySoft: "#F0ECFF",

  // Links and secondary highlights
  link: "#6D4AFF",

  // Status only - never decoration
  success: "#16A36A",
  successSoft: "#E8F7F0",
  warning: "#B7791F", // amber, darkened enough to read as text on white
  warningSoft: "#FEF5E6",
  danger: "#EF4444",
  dangerSoft: "#FDECEC",
  dangerBorder: "#F9CACA",
  info: "#6D4AFF",
  infoSoft: "#EEF2FF",

  // Photo selection sizes (customer page) - two clearly different colours
  normal: "#2F80ED",
  big: "#F59E0B",
} as const;

// Soft, layered shadows (web). Native falls back to the borders.
export const shadow = {
  card: "0 1px 2px rgba(23,23,47,0.04), 0 2px 8px rgba(23,23,47,0.04)",
  cardHover: "0 2px 4px rgba(23,23,47,0.05), 0 8px 20px rgba(23,23,47,0.07)",
  button: "0 6px 16px rgba(109,74,255,0.28)",
  menu: "0 12px 32px rgba(23,23,47,0.12)",
} as const;

// One timing for every hover/focus change (180-250ms, no bounce).
export const motion = {
  transitionDuration: "200ms",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

// Spread into a style to animate hover/focus changes on the web (ignored on phones).
export const transition = (Platform.OS === "web"
  ? { transitionProperty: "background-color, border-color, color, box-shadow, transform, opacity", ...motion }
  : {}) as object;

// Web-only box shadow (native has none; the 1px borders carry the separation there).
export const webShadow = (value: string) => (Platform.OS === "web" ? ({ boxShadow: value } as object) : {});

// 4-point spacing scale
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 10, card: 14, pill: 999 } as const;

// Minimum comfortable touch target on phones
export const touch = 44;

export const type = {
  title: { fontSize: 24, fontWeight: "700" as const, lineHeight: 30 },
  heading: { fontSize: 17, fontWeight: "700" as const, lineHeight: 23 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
} as const;

// Screen sizes: phone < 600 <= tablet < 1024 <= desktop
export const breakpoints = { tablet: 600, desktop: 1024 } as const;
