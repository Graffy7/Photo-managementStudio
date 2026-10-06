import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { notificationsApi } from "../../api/notificationsApi";
import type { Notification } from "../../types/notification";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { PagedRows } from "../../ui/PagedRows";
import { colors, space, type } from "../../ui/theme";

type Filter = "all" | "unread";
const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function typeTone(type: string): string {
  if (type === "EventReminder") return colors.warning;
  if (type === "LeadCreated") return colors.info;
  return colors.success;
}

export function NotificationsScreen() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ["notifications", filter, page],
    queryFn: () => notificationsApi.search({ isRead: filter === "unread" ? false : undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  // The unread total for the whole list (not just this page) decides whether "Mark all read" has work to do.
  const { data: unreadTotal } = useQuery({ queryKey: ["notifications-unread-count"], queryFn: notificationsApi.getUnreadCount });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const markAsRead = useMutation({ mutationFn: notificationsApi.markAsRead, onSuccess: invalidate });
  const markAllAsRead = useMutation({ mutationFn: notificationsApi.markAllAsRead, onSuccess: invalidate });

  const renderRow = (item: Notification) => (
    <Pressable
      style={({ pressed }) => [styles.row, !item.isRead && styles.rowUnread, pressed && !item.isRead && styles.pressed]}
      onPress={() => !item.isRead && markAsRead.mutate(item.notificationId)}
      disabled={item.isRead}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.message}${item.isRead ? "" : ". Unread, press to mark as read"}`}
    >
      <View style={[styles.dot, { backgroundColor: typeTone(item.notificationType) }, item.isRead && styles.dotRead]} />
      <View style={styles.rowMain}>
        <Text style={[styles.title, !item.isRead && styles.titleUnread]}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
      </View>
    </Pressable>
  );

  return (
    <Screen maxWidth={760}>
      <PageHeader
        title="Notifications"
        subtitle={data ? `${data.totalCount} ${filter === "unread" ? "unread" : "total"}` : null}
        actions={
          <Button
            label="Mark all read"
            icon="checkmark-done-outline"
            onPress={() => markAllAsRead.mutate()}
            disabled={!unreadTotal}
            loading={markAllAsRead.isPending}
          />
        }
      />
      <View style={{ marginBottom: space.lg }}>
        <FilterChips<Filter>
          options={[{ value: "all", label: "All" }, { value: "unread", label: unreadTotal ? `Unread (${unreadTotal})` : "Unread" }]}
          value={filter}
          onChange={(v) => { setFilter(v); setPage(1); }}
        />
      </View>

      <PagedRows
        items={data?.items}
        keyOf={(n) => n.notificationId}
        renderRow={renderRow}
        loading={isPending}
        fetching={isPlaceholderData}
        noun="notifications"
        error={isError ? "Couldn't load notifications. Check your connection and try again." : null}
        onRetry={() => refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filter === "unread" ? (
          <EmptyState icon="checkmark-done-outline" title="You're all caught up" text="There are no unread notifications."
            action={<Button label="Show all" onPress={() => { setFilter("all"); setPage(1); }} />} />
        ) : (
          <EmptyState icon="notifications-outline" title="No notifications yet" text="New enquiries, payments and event reminders will show up here." />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, padding: space.lg, minHeight: 64 },
  rowUnread: { backgroundColor: colors.cardRaised },
  pressed: { opacity: 0.8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  dotRead: { opacity: 0.35 },
  rowMain: { flex: 1, minWidth: 0, gap: 3 },
  title: { ...type.body, fontWeight: "500", color: colors.textMuted },
  titleUnread: { fontWeight: "700", color: colors.text },
  message: { ...type.small, color: colors.textMuted },
  date: { ...type.caption, color: colors.textFaint, marginTop: 2 },
});
