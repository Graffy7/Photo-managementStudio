import type { ReactNode } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radius, space, touch, type } from "./theme";
import { hoverGlow } from "./webHover";

// A record's page: back link, who/what it is, its status, the main action - then the details in
// cards (two columns on desktop, one on phones).
export type IconName = keyof typeof Ionicons.glyphMap;

export function DetailScreen({ backLabel, onBack, title, meta, metaItems, badges, actions, summary, left, right }: {
  backLabel: string;
  onBack: () => void;
  title: string;
  meta?: string | null;
  // The same facts as small icon pills (date, time, place) - easier to scan than one line of text.
  metaItems?: { icon: IconName; text: string }[];
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
          {metaItems && metaItems.length > 0 ? (
            <View style={styles.metaRow}>
              {metaItems.map((m) => (
                <View key={`${m.icon}${m.text}`} style={styles.metaPill}>
                  <Ionicons name={m.icon} size={14} color={colors.primary} />
                  <Text style={styles.metaPillText} numberOfLines={1}>{m.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
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

export function InfoCard({ title, icon, action, children }: { title: string; icon?: IconName; action?: ReactNode; children: ReactNode }) {
  return (
    <View {...hoverGlow} style={styles.card}>
      <View style={styles.cardHead}>
        {icon ? (
          <View style={styles.cardIcon}>
            <Ionicons name={icon} size={16} color={colors.onPrimaryFill} />
          </View>
        ) : null}
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

// With an icon the label and value sit beside a small tinted icon, so each fact is quick to find.
export function InfoItem({ label, value, tone, icon, iconColor = colors.primary }: { label: string; value: string; tone?: string; icon?: IconName; iconColor?: string }) {
  return (
    <View style={[styles.item, icon ? styles.itemWithIcon : null]}>
      {icon ? (
        <View style={[styles.itemIcon, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={[styles.itemValue, tone ? { color: tone } : null]} selectable>{value}</Text>
      </View>
    </View>
  );
}

// The key numbers of a record, side by side (2 per row on phones). An icon gives each number its
// own colour; `footer` sits under them (e.g. how much has been paid).
export function SummaryStrip({ items, footer }: { items: { label: string; value: string; tone?: string; icon?: IconName; color?: string }[]; footer?: ReactNode }) {
  const { isPhone } = useBreakpoint();
  const perRow = isPhone ? 2 : items.length;
  const rows: typeof items[] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return (
    <View style={styles.strip}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.stripRow, r > 0 && styles.stripRowSep]}>
          {row.map((it, c) => (
            <View key={it.label} style={[styles.stripCell, c > 0 && styles.stripCellSep, it.icon ? styles.stripCellWithIcon : null]}>
              {it.icon ? (
                <View style={[styles.stripIcon, { backgroundColor: it.color ?? colors.primaryFill }]}>
                  <Ionicons name={it.icon} size={18} color={colors.onPrimaryFill} />
                </View>
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.stripLabel}>{it.label}</Text>
                <Text style={[styles.stripValue, it.tone ? { color: it.tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{it.value}</Text>
              </View>
            </View>
          ))}
          {row.length < perRow && Array.from({ length: perRow - row.length }).map((_, i) => <View key={`pad${i}`} style={styles.stripCell} />)}
        </View>
      ))}
      {footer ? <View style={styles.stripFooter}>{footer}</View> : null}
    </View>
  );
}

// "₹20,000 of ₹55,000 paid · 36%" with a bar that fills up as payments come in.
export function ProgressLine({ label, value, color = colors.success }: { label: string; value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.progressHead}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={[styles.progressPct, { color }]}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { width: "100%", maxWidth: 1600, alignSelf: "center", paddingBottom: space.xxl },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 32, marginBottom: space.sm },
  backText: { ...type.small, fontWeight: "600", color: colors.link },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  headerPhone: { flexDirection: "column", alignItems: "stretch" },
  title: { ...type.title, color: colors.text },
  meta: { ...type.body, color: colors.textMuted, marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, maxWidth: "100%",
  },
  metaPillText: { ...type.small, fontWeight: "600", color: colors.text, flexShrink: 1 },
  cardIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryFill },
  itemWithIcon: { flexDirection: "row", alignItems: "center", gap: space.sm, minWidth: 190 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stripCellWithIcon: { flexDirection: "row", alignItems: "center", gap: space.md },
  stripIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stripFooter: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: space.md, paddingHorizontal: space.lg },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { ...type.small, fontWeight: "600", color: colors.text },
  progressPct: { ...type.small, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.cardRaised, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
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
