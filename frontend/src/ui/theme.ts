import { Platform } from "react-native";

// Studio OS design tokens - the one place colours, spacing, sizes and type live. Screens import
// these instead of repeating hex values, so the whole app stays consistent and can be tuned here.
//
// Theme: warm, muted, editorial - linen page, stone cards and sidebar, a quiet slate accent and a
// soft gold reserved for photography highlights. No pure white, nothing bright.

export const colors = {
  // Surfaces
  page: "#F1F0EC",
  bar: "#DAD9D3", // sidebar, top/bottom bars
  card: "#E5E4DF",
  cardRaised: "#ECEBE6", // inputs and raised areas on a card
  hover: "#DEDDD7", // soft highlight for hovered rows/items
  border: "#D2D1CA",
  borderStrong: "#C4C3BB",

  // Text
  text: "#292B31",
  textMuted: "#6F7078",
  textFaint: "#8A8B92",

  // The one action colour: main buttons and "you are here"
  primary: "#56566B",
  primaryHover: "#454559",
  onPrimary: "#F6F5F1",
  primarySoft: "#CFCED2",

  // Photography accent - used sparingly (highlights, the active marker, "Big" prints)
  accent: "#C5A477",
  accentSoft: "#EADFCC",

  // Links and secondary highlights
  link: "#4F5D75",

  // Status only - muted, never decoration
  success: "#4E7D5B",
  successSoft: "#DCE5DA",
  warning: "#A0762E",
  warningSoft: "#EFE3CC",
  danger: "#A3473F",
  dangerSoft: "#EED8D3",
  dangerBorder: "#D9B3AC",
  info: "#56566B",
  infoSoft: "#DCDBE0",

  // Photo selection sizes (customer page) - two clearly different, calm colours
  normal: "#5B7A99",
  big: "#B08D5B",
} as const;

// Soft, warm shadows (web). Native relies on the 1px borders.
export const shadow = {
  card: "0 1px 2px rgba(41,43,49,0.05)",
  cardHover: "0 4px 14px rgba(41,43,49,0.08)",
  button: "0 4px 12px rgba(69,69,89,0.22)",
  menu: "0 12px 32px rgba(41,43,49,0.16)",
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

// The app font. Inter is loaded on the web (see App.tsx); phones fall back to the system font.
export const fontFamily = Platform.OS === "web" ? "Inter, 'Segoe UI', system-ui, sans-serif" : undefined;

// 4-point spacing scale
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 8, card: 12, pill: 999 } as const;

// Minimum comfortable touch target on phones
export const touch = 44;

// Type scale: page titles 24/600, section headings 16/600, table content 14, labels 13.
export const type = {
  title: { fontSize: 24, fontWeight: "600" as const, lineHeight: 32 },
  heading: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 16 },
} as const;

// Screen sizes: phone < 600 <= tablet < 1024 <= desktop
export const breakpoints = { tablet: 600, desktop: 1024 } as const;
