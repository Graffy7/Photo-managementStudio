import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notificationsApi";
import type { Notification } from "../../types/notification";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

type Filter = "all" | "unread";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function typeTone(type: string): string {
  if (type === "EventReminder") return "#f2bd5c";
  if (type === "LeadCreated") return "#7fc0e6";
  return "#4cc493";
}

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () => notificationsApi.search({ isRead: filter === "unread" ? false : undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const markAsRead = useMutation({ mutationFn: notificationsApi.markAsRead, onSuccess: invalidate });
  const markAllAsRead = useMutation({ mutationFn: notificationsApi.markAllAsRead, onSuccess: invalidate });

  const unreadCount = data?.items.filter((n) => !n.isRead).length ?? 0;

  const renderItem = ({ item }: { item: Notification }) => (
    <Pressable
      style={[styles.row, !item.isRead && styles.rowUnread]}
      onPress={() => !item.isRead && markAsRead.mutate(item.notificationId)}
    >
      <View style={[styles.dot, { backgroundColor: typeTone(item.notificationType) }]} />
      <View style={styles.rowMain}>
        <Text style={[styles.title, !item.isRead && styles.titleUnread]}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>Notifications</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Pressable
            style={[styles.markAllButton, unreadCount === 0 && styles.markAllButtonDisabled]}
            onPress={() => markAllAsRead.mutate()}
            disabled={unreadCount === 0 || markAllAsRead.isPending}
          >
            {markAllAsRead.isPending ? (
              <ActivityIndicator color="#0d1826" size="small" />
            ) : (
              <Text style={styles.markAllButtonText}>Mark all read</Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, filter === "all" && styles.filterChipSelected]} onPress={() => setFilter("all")}>
          <Text style={[styles.filterChipText, filter === "all" && styles.filterChipTextSelected]}>All</Text>
        </Pressable>
        <Pressable style={[styles.filterChip, filter === "unread" && styles.filterChipSelected]} onPress={() => setFilter("unread")}>
          <Text style={[styles.filterChipText, filter === "unread" && styles.filterChipTextSelected]}>Unread</Text>
        </Pressable>
      </View>

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load notifications.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.notificationId)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 24, paddingTop: 0, maxWidth: 640, width: "100%", alignSelf: "center" }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>{filter === "unread" ? "You're all caught up." : "No notifications yet."}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 24, paddingBottom: 14, maxWidth: 640, width: "100%", alignSelf: "center" },
  headerActions: { flexDirection: "row", gap: 10 },
  pageTitle: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  markAllButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, justifyContent: "center" },
  markAllButtonDisabled: { backgroundColor: "#23405c" },
  markAllButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingBottom: 16, maxWidth: 640, width: "100%", alignSelf: "center" },
  filterChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: "#132540" },
  filterChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  filterChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  filterChipTextSelected: { color: "#ff9a4d" },
  row: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  rowUnread: { backgroundColor: "rgba(255, 154, 77, 0.05)" },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowMain: { flex: 1, gap: 3 },
  title: { color: "#a7b7cb", fontSize: 14, fontWeight: "600" },
  titleUnread: { color: "#e8edf3" },
  message: { color: "#a7b7cb", fontSize: 13 },
  date: { color: "#6f83a0", fontSize: 11, marginTop: 2 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
