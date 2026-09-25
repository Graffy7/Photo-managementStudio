import { StyleSheet, useWindowDimensions } from "react-native";

// Phone-width layout (< 480px) for the list screens: 16px side margins, a header whose buttons can
// wrap under the title, and each card's action buttons on their own row under the details instead
// of squeezing the customer's name into a narrow column beside them.
export const COMPACT_BREAKPOINT = 480;

export function useCompactLayout(): boolean {
  return useWindowDimensions().width < COMPACT_BREAKPOINT;
}

export const compactList = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 16 },
  header: { flexWrap: "wrap", gap: 12 },
  row: { flexDirection: "column", alignItems: "stretch", gap: 10 },
  actions: { flexWrap: "wrap", justifyContent: "flex-start" },
});
