import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { auditLogsApi } from "../../api/auditLogsApi";
import type { AuditLogEntry } from "../../types/auditLog";
import { actionTone, TONE_COLORS } from "../../utils/auditTone";

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

function ActionDot({ action }: { action: string }) {
  return <View style={[styles.dot, { backgroundColor: TONE_COLORS[actionTone(action)] }]} />;
}

export function AuditLogScreen({ onBack }: { onBack: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => auditLogsApi.search({ page: 1, pageSize: 50 }),
    refetchInterval: 15000,
  });

  const renderItem = ({ item }: { item: AuditLogEntry }) => (
    <View style={styles.row}>
      <ActionDot action={item.action} />
      <View style={styles.rowBody}>
        <Text style={styles.line}>
          <Text style={styles.actor}>{item.actorName ?? "Someone"}</Text>
          {" "}
          <Text style={styles.action}>{item.action.toLowerCase()}</Text>
          {item.studioName ? <Text style={styles.studio}> — {item.studioName}</Text> : null}
          <Text style={styles.module}> ({item.module})</Text>
        </Text>
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Studios</Text>
        </Pressable>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Every create, edit, activate, deactivate, block and unblock — newest first.</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.empty}>Couldn't load activity.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.auditLogId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>Nothing has happened yet.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  header: { marginBottom: 18 },
  backButton: { marginBottom: 10 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 4 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowBody: { flex: 1 },
  line: { fontSize: 14, lineHeight: 20 },
  actor: { color: "#e8edf3", fontWeight: "700" },
  action: { color: "#a7b7cb" },
  studio: { color: "#7fc0e6", fontWeight: "600" },
  module: { color: "#6f83a0", fontSize: 12 },
  time: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
