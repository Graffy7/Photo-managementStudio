// Studio OS design tokens - the one place colours, spacing, sizes and type live. Screens import
// these instead of repeating hex values, so the whole app stays consistent and can be tuned here.

export const colors = {
  // Surfaces, darkest to lightest
  page: "#0b1522",
  bar: "#0f1b2b", // sidebar, top/bottom bars
  card: "#122033",
  cardRaised: "#172a42", // hover / pressed / inputs on a card
  border: "#1f3149",
  borderStrong: "#2c4463",

  // Text
  text: "#e8edf3",
  textMuted: "#9fb0c5",
  textFaint: "#6f83a0",

  // The one brand colour: main actions and "you are here"
  primary: "#ff9a4d",
  onPrimary: "#1a0f05",
  primarySoft: "rgba(255,154,77,0.14)",

  // Links and secondary highlights
  link: "#8cc8f0",

  // Status only - never decoration
  success: "#6ee0ad",
  successSoft: "#12382b",
  warning: "#f5c66b",
  warningSoft: "#3a2c10",
  danger: "#ff9a93",
  dangerSoft: "#3d1a1a",
  dangerBorder: "#5a2626",
  info: "#8cc8f0",
  infoSoft: "#16304d",

  // Photo selection sizes (customer page)
  normal: "#8cc8f0",
  big: "#ff9a4d",
} as const;

// 4-point spacing scale
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 8, card: 12, pill: 999 } as const;

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
