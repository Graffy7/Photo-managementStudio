import { Platform } from "react-native";

// Studio OS design tokens - the one place colours, spacing, sizes and type live. Screens import
// these instead of repeating hex values, so the whole app stays consistent and can be tuned here.
//
// Premium Dark Photography theme: soft charcoal surfaces (never pure black), a muted lavender
// accent, calm status colours and quiet 1px outlines - comfortable for long working hours.

export const colors = {
  // Surfaces
  page: "#191B22",
  bar: "#20232B", // sidebar, top/bottom bars
  card: "#22252E",
  cardRaised: "#292C36", // secondary surface: inputs, raised areas
  hover: "#303441",
  border: "#343746",
  borderStrong: "#4B4F63", // hover / emphasis border
  divider: "#30333D",

  // Text
  text: "#E6E7EC",
  textMuted: "#A1A5B3",
  textFaint: "#7D8292",
  textDisabled: "#656A78",

  // Primary accent: lavender. Text on a lavender fill is charcoal for contrast.
  primary: "#B5A5FF",
  primaryHover: "#9C89F5",
  onPrimary: "#191B22",
  primarySoft: "rgba(181,165,255,0.12)",

  // Same lavender, for the small "you are here" markers.
  accent: "#B5A5FF",
  accentSoft: "rgba(181,165,255,0.12)",

  // Links and secondary highlights
  link: "#B5A5FF",

  // Status - muted
  success: "#78C9A4",
  successSoft: "rgba(120,201,164,0.14)",
  warning: "#E5B86B",
  warningSoft: "rgba(229,184,107,0.14)",
  danger: "#E58B91",
  dangerSoft: "rgba(229,139,145,0.14)",
  dangerBorder: "rgba(229,139,145,0.4)",
  info: "#85B9E8",
  infoSoft: "rgba(133,185,232,0.14)",

  // Photo selection sizes (customer page) - two clearly different colours
  normal: "#85B9E8",
  big: "#E5B86B",
} as const;

// Soft shadows (web). Native relies on the 1px borders.
export const shadow = {
  card: "0 1px 2px rgba(8,9,13,0.35)",
  cardHover: "0 6px 18px rgba(8,9,13,0.45)",
  button: "0 6px 16px rgba(156,137,245,0.25)",
  menu: "0 14px 36px rgba(8,9,13,0.6)",
} as const;

// One timing for every hover/focus change (180-250ms, no bounce).
export const motion = {
  transitionDuration: "200ms",
  transitionTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

// People who ask their system for reduced motion get instant changes instead of animations.
const reduceMotion =
  Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Spread into a style to animate hover/focus changes on the web (ignored on phones).
export const transition = (Platform.OS === "web" && !reduceMotion
  ? { transitionProperty: "background-color, border-color, color, box-shadow, transform, opacity", ...motion }
  : {}) as object;

// Hover movement (lift / slide / zoom) - none at all when reduced motion is on.
export const hoverMotion = (transform: object[]) => (reduceMotion ? {} : { transform }) as object;

// Web-only box shadow (native has none; the 1px borders carry the separation there).
export const webShadow = (value: string) => (Platform.OS === "web" ? ({ boxShadow: value } as object) : {});

// The app font. Inter is loaded on the web (see App.tsx); phones fall back to the system font.
export const fontFamily = Platform.OS === "web" ? "Inter, 'Segoe UI', system-ui, sans-serif" : undefined;

// 4-point spacing scale
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 8, card: 12, pill: 999 } as const;

// Minimum comfortable touch target on phones
export const touch = 44;

// Type scale: page titles 24/600, section headings 16/600, card titles 15/600, table text 14,
// secondary text 13, small labels 12/500.
export const type = {
  title: { fontSize: 24, fontWeight: "600" as const, lineHeight: 32 },
  heading: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  cardTitle: { fontSize: 15, fontWeight: "600" as const, lineHeight: 21 },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
} as const;

// Screen sizes: phone < 600 <= tablet < 1024 <= desktop
export const breakpoints = { tablet: 600, desktop: 1024 } as const;
