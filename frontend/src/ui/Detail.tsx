import type { ReactNode } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radius, space, touch, type } from "./theme";

// A record's page: back link, who/what it is, its status, the main action - then the details in
// cards (two columns on desktop, one on phones).
export function DetailScreen({ backLabel, onBack, title, meta, badges, actions, summary, left, right }: {
  backLabel: string;
  onBack: () => void;
  title: string;
  meta?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
  // Key figures right under the header (money, counts).
  summary?: ReactNode;
  left: ReactNode;
  right?: ReactNode;
}) {
  const { isPhone, isDesktop } = useBreakpoint();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { padding: isPhone ? space.lg : space.xl }]}>
      <Pressable onPress={onBack} style={styles.back} accessibilityRole="link" hitSlop={6}>
        <Ionicons name="chevron-back" size={18} color={colors.link} />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <View style={[styles.header, isPhone && styles.headerPhone]}>
        <View style={{ flex: isPhone ? undefined : 1, minWidth: 0 }}>
          <Text style={styles.title}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          {badges ? <View style={styles.badges}>{badges}</View> : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {summary ? <View style={{ marginTop: space.lg }}>{summary}</View> : null}
      <View style={[styles.columns, isDesktop && right ? styles.columnsWide : null]}>
        <View style={[styles.col, isDesktop && right ? { flex: 3 } : null]}>{left}</View>
        {right ? <View style={[styles.col, isDesktop ? { flex: 2 } : null]}>{right}</View> : null}
      </View>
    </ScrollView>
  );
}

export function InfoCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

// Label over value, laid out in a wrapping grid.
export function InfoGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function InfoItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={[styles.itemValue, tone ? { color: tone } : null]} selectable>{value}</Text>
    </View>
  );
}

// The key numbers of a record, side by side (2 per row on phones).
export function SummaryStrip({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  const { isPhone } = useBreakpoint();
  const perRow = isPhone ? 2 : items.length;
  const rows: typeof items[] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return (
    <View style={styles.strip}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.stripRow, r > 0 && styles.stripRowSep]}>
          {row.map((it, c) => (
            <View key={it.label} style={[styles.stripCell, c > 0 && styles.stripCellSep]}>
              <Text style={styles.stripLabel}>{it.label}</Text>
              <Text style={[styles.stripValue, it.tone ? { color: it.tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{it.value}</Text>
            </View>
          ))}
          {row.length < perRow && Array.from({ length: perRow - row.length }).map((_, i) => <View key={`pad${i}`} style={styles.stripCell} />)}
        </View>
      ))}
    </View>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingBottom: space.xxl },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 32, marginBottom: space.sm },
  backText: { ...type.small, fontWeight: "600", color: colors.link },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  headerPhone: { flexDirection: "column", alignItems: "stretch" },
  title: { ...type.title, color: colors.text },
  meta: { ...type.body, color: colors.textMuted, marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  columns: { gap: space.lg, marginTop: space.lg },
  columnsWide: { flexDirection: "row", alignItems: "flex-start" },
  col: { gap: space.lg, minWidth: 0 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, minHeight: 28 },
  cardTitle: { ...type.heading, color: colors.text, flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.md, columnGap: space.xl },
  item: { minWidth: 140, flexShrink: 1, gap: 2 },
  itemLabel: { ...type.caption, color: colors.textMuted },
  itemValue: { ...type.body, fontWeight: "600", color: colors.text },
  strip: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  stripRow: { flexDirection: "row" },
  stripRowSep: { borderTopWidth: 1, borderTopColor: colors.border },
  stripCell: { flex: 1, minWidth: 0, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: touch + 20 },
  stripCellSep: { borderLeftWidth: 1, borderLeftColor: colors.border },
  stripLabel: { ...type.caption, color: colors.textMuted },
  stripValue: { fontSize: 20, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"], marginTop: 2 },
  empty: { ...type.body, color: colors.textMuted },
});
