import { useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { Pagination } from "./Pagination";
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

// The narrowest a flexible column (flex: 1) may get before the table scrolls sideways instead.
const MIN_FLEX_COLUMN = 84;

interface Props<T> {
  items: T[] | undefined;
  keyOf: (item: T) => string | number;
  columns: Column<T>[];
  // Phone / tablet layout for one item.
  renderCard: (item: T) => ReactNode;
  onRowPress?: (item: T) => void;
  loading: boolean;
  // A different page / filter is being fetched while the previous rows are still shown.
  fetching?: boolean;
  // What the rows are, for the "1–20 of 345 customers" line under the list.
  noun?: string;
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
  const { items, keyOf, columns, renderCard, onRowPress, loading, fetching, noun, error, onRetry, empty, sort, onSortChange, page, pageSize, totalCount, onPageChange } = props;
  const { isDesktop, isPhone } = useBreakpoint();
  const top = useRef<View>(null);
  // Native only: the width the table has to fill (the web lays this out in CSS, see below).
  const [available, setAvailable] = useState(0);

  // After a page change the list starts again from its first row, not wherever the pager was.
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    if (Platform.OS === "web") {
      (top.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [page]);

  // Narrower than its columns need (a small laptop, a split window): the table scrolls sideways
  // inside its own box instead of squeezing every column or widening the whole page.
  const minTableWidth = columns.reduce((sum, c) => sum + (c.width ?? MIN_FLEX_COLUMN * (c.flex ?? 1)), 0) + space.sm * 2;

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

  // Tablets have room for two cards side by side; phones get one column.
  const cardsStyle = !isPhone && Platform.OS === "web" ? styles.cardsTwoUp : styles.cards;

  let body: ReactNode;
  if (loading) {
    body = (
      <View style={isDesktop ? undefined : cardsStyle}>
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
      <View style={cardsStyle}>
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

  const refreshing = !!fetching && !loading;

  return (
    <View ref={top} style={styles.anchor}>
      {isDesktop && Platform.OS === "web" ? (
        // The table always fills its box; only when the columns need more room than the box has
        // does it keep their minimum width and scroll sideways inside the box.
        <View style={[styles.table, styles.tableScroll]}>
          <View style={[{ minWidth: minTableWidth }, refreshing && styles.refreshing]}>
            {header}
            {body}
          </View>
        </View>
      ) : isDesktop ? (
        <View style={styles.table} onLayout={(e) => setAvailable(Math.floor(e.nativeEvent.layout.width) - 2)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={minTableWidth > available}>
            <View style={[{ width: Math.max(available, minTableWidth) }, refreshing && styles.refreshing]}>
              {header}
              {body}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={refreshing && styles.refreshing}>{body}</View>
      )}
      {!loading && !error && (
        <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={onPageChange} loading={refreshing} noun={noun} />
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
  tableScroll: { overflowX: "auto", overflowY: "hidden" } as object,
  cards: { gap: space.md },
  cardsTwoUp: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: space.md } as object,
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm },
  pressed: { backgroundColor: colors.cardRaised },
  errorBox: { alignItems: "center", gap: space.md, paddingVertical: 40 },
  errorText: { ...type.body, color: colors.danger, textAlign: "center" },
  // Leaves room above the list when it is scrolled back into view after a page change.
  anchor: Platform.OS === "web" ? ({ scrollMarginTop: space.lg } as object) : {},
  // Rows of the previous page stay visible (no jump) but dimmed while the next page loads.
  refreshing: { opacity: 0.5 },
  cellTitle: { ...type.body, fontWeight: "600", color: colors.text },
  cellSub: { ...type.small, color: colors.textMuted },
  cellMoney: { ...type.body, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
});
