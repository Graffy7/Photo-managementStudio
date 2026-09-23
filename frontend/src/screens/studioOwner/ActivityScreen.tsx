import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { studioActivityApi } from "../../api/studioActivityApi";
import type { AuditLogEntry } from "../../types/auditLog";
import { actionTone, TONE_COLORS } from "../../utils/auditTone";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

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

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["studio-activity"],
    queryFn: () => studioActivityApi.search({ page: 1, pageSize: 50 }),
    refetchInterval: 15000,
  });
  useRefetchOnFocus(refetch);

  const renderItem = ({ item }: { item: AuditLogEntry }) => (
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
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Settings</Text>
        </Pressable>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>Everything created, edited, or changed in your studio — newest first.</Text>
      </View>

      {isPending ? (
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
          contentContainerStyle={{ padding: 24, paddingTop: 0, maxWidth: 640, width: "100%", alignSelf: "center" }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  header: { padding: 24, paddingBottom: 18, maxWidth: 640, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 10 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 4 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowBody: { flex: 1, gap: 3 },
  line: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  action: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  modulePill: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8 },
  modulePillText: { color: "#7fc0e6", fontSize: 10, fontWeight: "700" },
  meta: { color: "#6f83a0", fontSize: 12 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
