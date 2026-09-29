import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, space, type } from "./theme";
import { useBreakpoint } from "./useBreakpoint";

// Page title, one line of context, and the page's actions (usually one primary button).
// On phones the actions drop under the title instead of squeezing it.
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string | null; actions?: ReactNode }) {
  const { isPhone } = useBreakpoint();
  return (
    <View style={[styles.header, isPhone && styles.headerPhone]}>
      <View style={{ flex: isPhone ? undefined : 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {/* Always rendered so the header keeps its height while the count loads. */}
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle ?? " "}</Text>
      </View>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg },
  headerPhone: { flexDirection: "column", alignItems: "stretch" },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
