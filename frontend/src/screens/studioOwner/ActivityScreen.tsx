import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { studioActivityApi } from "../../api/studioActivityApi";
import type { AuditLogEntry } from "../../types/auditLog";
import { actionTone, TONE_COLORS } from "../../utils/auditTone";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { EmptyState } from "../../ui/EmptyState";
import { PagedRows } from "../../ui/PagedRows";
import { colors, radius, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;

function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function ActivityScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [page, setPage] = useState(1);

  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ["studio-activity", page],
    queryFn: () => studioActivityApi.search({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    // Live while on screen, and only on the newest page - older pages don't change.
    refetchInterval: isFocused && page === 1 ? 15000 : false,
  });
  useRefetchOnFocus(refetch);

  const renderRow = (item: AuditLogEntry) => (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: TONE_COLORS[actionTone(item.action)] }]} />
      <View style={styles.rowBody}>
        <View style={styles.line}>
          <Text style={styles.action}>{item.action}</Text>
          <View style={styles.modulePill}>
            <Text style={styles.modulePillText}>{item.module}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{item.actorName ?? "Someone"} · {timeAgo(item.createdAt)}</Text>
      </View>
    </View>
  );

  return (
    <Screen maxWidth={1100}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="link" hitSlop={6}>
        <Ionicons name="chevron-back" size={18} color={colors.link} />
        <Text style={styles.backText}>Settings</Text>
      </Pressable>
      <PageHeader title="Activity" subtitle="Everything created, edited or changed in your studio — newest first." />

      <PagedRows
        items={data?.items}
        keyOf={(a) => a.auditLogId}
        renderRow={renderRow}
        loading={isPending}
        fetching={isPlaceholderData}
        noun="entries"
        error={isError ? "Couldn't load activity. Check your connection and try again." : null}
        onRetry={() => refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={<EmptyState icon="time-outline" title="Nothing has happened yet" text="As you add customers, events and payments, each change is listed here." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", minHeight: 32, marginBottom: space.sm },
  backText: { ...type.small, fontWeight: "600", color: colors.link },
  row: { flexDirection: "row", gap: space.md, padding: space.lg, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  action: { ...type.body, fontWeight: "600", color: colors.text },
  modulePill: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: 8 },
  modulePillText: { ...type.caption, fontWeight: "700", color: colors.link },
  meta: { ...type.small, color: colors.textFaint },
});
