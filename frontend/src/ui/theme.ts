import { Platform } from "react-native";

// Studio OS design tokens - the one place colours, spacing, sizes and type live. Screens import
// these instead of repeating hex values, so the whole app stays consistent and can be tuned here.
//
// Midnight Blue theme: deep navy surfaces, an electric-blue accent, bright status colours and
// quiet blue-tinted 1px outlines. The Dashboard adds gradients and glows on top of these.

export const colors = {
  // Surfaces
  page: "#070F24",
  bar: "#0A1530", // sidebar, top/bottom bars
  card: "#0C1733",
  cardRaised: "#111E3F", // secondary surface: inputs, raised areas
  hover: "#162650",
  border: "#1E2D57",
  borderStrong: "#2E4377", // hover / emphasis border
  divider: "#1A2850",

  // Text
  text: "#F2F5FF",
  textMuted: "#A4AFCF",
  textFaint: "#6F7BA0",
  textDisabled: "#56618A",

  // Primary accent: light electric blue - readable as text, icons and outlines on navy. Text on a
  // primary fill is navy for contrast.
  primary: "#5B9BFF",
  primaryHover: "#3F86F5",
  onPrimary: "#070F24",
  primarySoft: "rgba(91,155,255,0.12)",

  // Strong blue for solid fills that carry white text: primary buttons, the active menu item.
  primaryFill: "#2B6FEB",
  primaryFillHover: "#2F7BFF",
  onPrimaryFill: "#FFFFFF",

  // Same blue, for the small "you are here" markers.
  accent: "#5B9BFF",
  accentSoft: "rgba(91,155,255,0.12)",

  // Links and secondary highlights
  link: "#5B9BFF",

  // Status
  success: "#22C58B",
  successSoft: "rgba(34,197,139,0.14)",
  warning: "#FFA53D",
  warningSoft: "rgba(255,165,61,0.14)",
  danger: "#FF5C75",
  dangerSoft: "rgba(255,92,117,0.14)",
  dangerBorder: "rgba(255,92,117,0.4)",
  info: "#5BB4FF",
  infoSoft: "rgba(91,180,255,0.14)",

  // Photo selection sizes (customer page) - two clearly different colours
  normal: "#5BB4FF",
  big: "#FFA53D",
} as const;

// Soft shadows (web). Native relies on the 1px borders.
export const shadow = {
  card: "0 1px 2px rgba(2,6,20,0.35)",
  cardHover: "0 6px 18px rgba(2,6,20,0.45)",
  button: "0 6px 18px rgba(47,123,255,0.4)",
  menu: "0 14px 36px rgba(2,6,20,0.6)",
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

// Hover movement (lift / slide / zoom). These are a couple of pixels, so they stay on with reduced
// motion too - they just switch instantly then, because `transition` above is off.
export const hoverMotion = (transform: object[]) => ({ transform }) as object;

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
