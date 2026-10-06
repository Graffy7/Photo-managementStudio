import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radius, space, type } from "./theme";

interface Props {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  // A page is being fetched: the controls stay in place (no jumping) and show a small spinner.
  loading?: boolean;
  // What is being counted, for the "1–20 of 345 customers" line.
  noun?: string;
}

// The app's one pager, used under every list: "1–20 of 345", First / Previous, page numbers,
// Next / Last. On phones the numbers collapse to "Page 3 of 18" so the row always fits.
// Hidden when everything fits on one page.
export function Pagination({ page, pageSize, totalCount, onPageChange, loading, noun }: Props) {
  const { isPhone } = useBreakpoint();
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount <= pageSize) return null;

  const current = Math.min(Math.max(1, page), pages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalCount);
  const go = (p: number) => {
    const target = Math.min(Math.max(1, p), pages);
    if (target !== current) onPageChange(target);
  };

  return (
    <View style={[styles.bar, isPhone && styles.barPhone]} accessibilityRole="toolbar" accessibilityLabel="Pagination">
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {totalCount.toLocaleString("en-IN")}{noun ? ` ${noun}` : ""}
        </Text>
        {loading ? <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Loading page" /> : null}
      </View>

      <View style={styles.controls}>
        <IconButton icon="play-skip-back" label="First page" disabled={current <= 1} onPress={() => go(1)} />
        <IconButton icon="chevron-back" label="Previous page" disabled={current <= 1} onPress={() => go(current - 1)} />

        {isPhone ? (
          <Text style={styles.pageOf} accessibilityLiveRegion="polite">Page {current} of {pages}</Text>
        ) : (
          pageWindow(current, pages).map((p, i) =>
            p === null ? (
              <Text key={`gap${i}`} style={styles.gap}>…</Text>
            ) : (
              <Pressable
                key={p}
                onPress={() => go(p)}
                disabled={p === current}
                accessibilityRole="button"
                accessibilityLabel={`Page ${p}`}
                accessibilityState={{ selected: p === current }}
                style={({ pressed }) => [styles.number, p === current && styles.numberCurrent, pressed && styles.pressed]}
              >
                <Text style={[styles.numberText, p === current && styles.numberTextCurrent]}>{p}</Text>
              </Pressable>
            ))
        )}

        <IconButton icon="chevron-forward" label="Next page" disabled={current >= pages} onPress={() => go(current + 1)} />
        <IconButton icon="play-skip-forward" label="Last page" disabled={current >= pages} onPress={() => go(pages)} />
      </View>
    </View>
  );
}

// 1 … 4 5 [6] 7 8 … 20 : first, last, the current page and two neighbours each side.
function pageWindow(current: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - 2, pages - 5));
  const end = Math.min(pages - 1, Math.max(current + 2, 6));
  const out: (number | null)[] = [1];
  if (start > 2) out.push(null);
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pages - 1) out.push(null);
  out.push(pages);
  return out;
}

function IconButton({ icon, label, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
    </Pressable>
  );
}

const SIZE = 40;

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
    gap: space.md, marginTop: space.lg,
  },
  barPhone: { flexDirection: "column", alignItems: "stretch", gap: space.sm },
  summary: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 24 },
  summaryText: { ...type.small, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" },
  iconButton: {
    width: SIZE, height: SIZE, borderRadius: radius.control, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card,
  },
  number: {
    minWidth: SIZE, height: SIZE, paddingHorizontal: 8, borderRadius: radius.control, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  numberCurrent: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  numberText: { ...type.small, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
  numberTextCurrent: { color: colors.primary },
  gap: { ...type.small, color: colors.textFaint, paddingHorizontal: 2 },
  pageOf: { ...type.small, fontWeight: "600", color: colors.text, paddingHorizontal: space.sm, fontVariant: ["tabular-nums"], minWidth: 110, textAlign: "center" },
  disabled: { opacity: 0.4 },
  pressed: { backgroundColor: colors.cardRaised },
});
