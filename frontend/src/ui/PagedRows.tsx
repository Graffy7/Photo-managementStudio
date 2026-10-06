import { useEffect, useRef, type ReactNode } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Pagination } from "./Pagination";
import { colors, radius, space, type } from "./theme";

// A simple paged feed (notifications, activity): rows in one card with the app's pager underneath.
// Same loading, empty, error and page-change behaviour as DataList, without table columns.
export function PagedRows<T>({
  items, keyOf, renderRow, loading, fetching, error, onRetry, empty, page, pageSize, totalCount, onPageChange, noun,
}: {
  items: T[] | undefined;
  keyOf: (item: T) => string | number;
  renderRow: (item: T) => ReactNode;
  loading: boolean;
  fetching?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty: ReactNode;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  noun?: string;
}) {
  const top = useRef<View>(null);
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    if (Platform.OS === "web") {
      (top.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [page]);

  const refreshing = !!fetching && !loading;

  let body: ReactNode;
  if (loading) {
    body = (
      <View style={styles.card}>
        {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.rowSep]}><Skeleton height={16} width="45%" /><Skeleton height={12} width="70%" /></View>
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
  } else {
    body = (
      <View style={[styles.card, refreshing && styles.refreshing]}>
        {items.map((item, i) => (
          <View key={keyOf(item)} style={i > 0 && styles.rowSep}>{renderRow(item)}</View>
        ))}
      </View>
    );
  }

  return (
    <View ref={top} style={styles.anchor}>
      {body}
      {!loading && !error && (
        <Pagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={onPageChange} loading={refreshing} noun={noun} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: Platform.OS === "web" ? ({ scrollMarginTop: space.lg } as object) : {},
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { padding: space.lg, gap: space.sm },
  rowSep: { borderTopWidth: 1, borderTopColor: colors.border },
  refreshing: { opacity: 0.5 },
  errorBox: { alignItems: "center", gap: space.md, paddingVertical: 40 },
  errorText: { ...type.body, color: colors.danger, textAlign: "center" },
});
