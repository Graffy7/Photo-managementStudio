import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useBreakpoint } from "./useBreakpoint";
import { colors, space } from "./theme";

// A page: the whole page scrolls (no small scrolling boxes inside it), with comfortable side
// margins and a readable maximum width on large screens.
export function Screen({ children, maxWidth = 1280 }: { children: ReactNode; maxWidth?: number }) {
  const { isPhone } = useBreakpoint();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { maxWidth, padding: isPhone ? space.lg : space.xl }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { width: "100%", alignSelf: "center", paddingBottom: space.xxl },
});
