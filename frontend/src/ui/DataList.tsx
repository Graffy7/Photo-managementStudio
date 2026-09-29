import { useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radius, space, type } from "./theme";

export interface Column<T> {
  key: string;
  label: string;
  // Share of the row width (default 1); `width` fixes it instead.
  flex?: number;
  width?: number;
  align?: "left" | "right";
  // Name the server sorts by ("date", "customer"...); columns without it aren't sortable.
  sortKey?: string;
  render: (item: T) => ReactNode;
}

export interface SortState {
  by: string;
  desc: boolean;
}

interface Props<T> {
  items: T[] | undefined;
  keyOf: (item: T) => string | number;
  columns: Column<T>[];
  // Phone / tablet layout for one item.
  renderCard: (item: T) => ReactNode;
  onRowPress?: (item: T) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty: ReactNode;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

// A list that is a real table on desktop (sortable headers, one line per record) and a stack of
// cards on phones and tablets. Loading shows placeholder rows of the final size, so nothing jumps.
export function DataList<T>(props: Props<T>) {
  const { items, keyOf, columns, renderCard, onRowPress, loading, error, onRetry, empty, sort, onSortChange, page, pageSize, totalCount, onPageChange } = props;
  const { isDesktop } = useBreakpoint();

  const header = isDesktop && (
    <View style={styles.headRow}>
      {columns.map((c) => {
        const active = !!c.sortKey && sort?.by === c.sortKey;
        const label = (
          <View style={[styles.headInner, c.align === "right" && styles.right]}>
            <Text style={[styles.headText, active && styles.headTextActive]} numberOfLines={1}>{c.label}</Text>
            {c.sortKey && (
              <Ionicons
                name={active ? (sort!.desc ? "arrow-down" : "arrow-up") : "swap-vertical"}
                size={13}
                color={active ? colors.primary : colors.textFaint}
              />
            )}
          </View>
        );
        return (
          <View key={c.key} style={cellStyle(c)}>
            {c.sortKey && onSortChange ? (
              <Pressable
                onPress={() => onSortChange(!active ? { by: c.sortKey!, desc: false } : !sort!.desc ? { by: c.sortKey!, desc: true } : null)}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${c.label}`}
                style={styles.headPress}
              >
                {label}
              </Pressable>
            ) : label}
          </View>
        );
      })}
    </View>
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <View style={isDesktop ? undefined : styles.cards}>
        {Array.from({ length: Math.min(pageSize, 8) }).map((_, i) =>
          isDesktop ? (
            <View key={i} style={styles.row}><Skeleton height={18} width="70%" /></View>
          ) : (
            <Skeleton key={i} height={120} rounded={radius.card} />
          ))}
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{error}</Text>
        {onRetry && <Button label="Try again" onPress={onRetry} />}
      </View>
    );
  } else if (!items || items.length === 0) {
    body = empty;
  } else if (isDesktop) {
    body = items.map((item) => <TableRow key={keyOf(item)} item={item} columns={columns} onPress={onRowPress} />);
  } else {
    body = (
      <View style={styles.cards}>
        {items.map((item) => (
          <Pressable
            key={keyOf(item)}
            onPress={onRowPress ? () => onRowPress(item) : undefined}
            disabled={!onRowPress}
            style={({ pressed }) => [styles.card, pressed && onRowPress && styles.pressed]}
          >
            {renderCard(item)}
          </Pressable>
        ))}
      </View>
    );
  }

  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <View>
      <View style={isDesktop ? styles.table : undefined}>
        {header}
        {body}
      </View>
      {!loading && !error && totalCount > pageSize && (
        <View style={styles.pager}>
          <Text style={styles.pagerText}>{from}–{to} of {totalCount}</Text>
          <View style={styles.pagerButtons}>
            <Button label="Previous" icon="chevron-back" onPress={() => onPageChange(page - 1)} disabled={page <= 1} />
            <Text style={styles.pagerText}>Page {page} of {pages}</Text>
            <Button label="Next" onPress={() => onPageChange(page + 1)} disabled={page >= pages} />
          </View>
        </View>
      )}
    </View>
  );
}

function TableRow<T>({ item, columns, onPress }: { item: T; columns: Column<T>[]; onPress?: (item: T) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={onPress ? () => onPress(item) : undefined}
      disabled={!onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[styles.row, hover && onPress && styles.rowHover]}
    >
      {columns.map((c) => (
        <View key={c.key} style={[cellStyle(c), c.align === "right" && styles.right]}>{c.render(item)}</View>
      ))}
    </Pressable>
  );
}

function cellStyle<T>(c: Column<T>) {
  return c.width ? { width: c.width, paddingHorizontal: space.sm } : { flex: c.flex ?? 1, minWidth: 0, paddingHorizontal: space.sm };
}

// Small text helpers for table cells and cards, so every list reads the same way.
export function CellTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.cellTitle} numberOfLines={1}>{children}</Text>;
}
export function CellSub({ children }: { children: ReactNode }) {
  return <Text style={styles.cellSub} numberOfLines={1}>{children}</Text>;
}
export function CellMoney({ children, tone }: { children: ReactNode; tone?: string }) {
  return <Text style={[styles.cellMoney, tone ? { color: tone } : null]} numberOfLines={1}>{children}</Text>;
}

const styles = StyleSheet.create({
  table: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  headRow: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bar },
  headPress: { alignSelf: "stretch" },
  headInner: { flexDirection: "row", alignItems: "center", gap: 4 },
  headText: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  headTextActive: { color: colors.primary },
  right: { alignItems: "flex-end", justifyContent: "flex-end" },
  row: {
    flexDirection: "row", alignItems: "center", minHeight: 60, paddingHorizontal: space.sm, paddingVertical: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowHover: { backgroundColor: colors.cardRaised },
  cards: { gap: space.md },
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm },
  pressed: { backgroundColor: colors.cardRaised },
  errorBox: { alignItems: "center", gap: space.md, paddingVertical: 40 },
  errorText: { ...type.body, color: colors.danger, textAlign: "center" },
  pager: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space.md, marginTop: space.lg },
  pagerButtons: { flexDirection: "row", alignItems: "center", gap: space.md },
  pagerText: { ...type.small, color: colors.textMuted },
  cellTitle: { ...type.body, fontWeight: "600", color: colors.text },
  cellSub: { ...type.small, color: colors.textMuted },
  cellMoney: { ...type.body, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
});
