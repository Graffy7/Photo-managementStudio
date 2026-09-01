import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "../../api/eventsApi";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, type EventStatus, type StudioEvent } from "../../types/event";
import { StatusPill } from "../../components/StatusPill";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: EventStatus): "good" | "bad" | "warn" | "neutral" {
  if (status === "Completed") return "good";
  if (status === "Cancelled") return "bad";
  if (status === "InProgress") return "warn";
  return "neutral";
}

export function EventListScreen({ onCreate, onEdit }: { onCreate: () => void; onEdit: (event: StudioEvent) => void }) {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [eventStatus, setEventStatus] = useState<EventStatus | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["events", search, eventStatus],
    queryFn: () => eventsApi.search({ search: search || undefined, eventStatus: eventStatus ?? undefined, page: 1, pageSize: 50 }),
  });

  const renderItem = ({ item }: { item: StudioEvent }) => (
    <Pressable style={styles.row} onPress={() => onEdit(item)}>
      <View style={styles.rowMain}>
        <Text style={styles.eventDate}>{formatDate(item.eventDate)}{item.startTime ? ` · ${item.startTime}` : ""}</Text>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <Text style={styles.contact}>{item.customerMobileNumber}{item.venue ? ` · ${item.venue}` : ""}</Text>

        <View style={styles.pillRow}>
          <StatusPill label={EVENT_STATUS_LABELS[item.eventStatus]} tone={statusTone(item.eventStatus)} />
          {item.eventTypeName && <StatusPill label={item.eventTypeName} tone="neutral" />}
        </View>

        {item.budget ? <Text style={styles.meta}>{formatCurrency(item.budget)}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Pressable style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>+ New Event</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by customer or venue"
        placeholderTextColor="#6f83a0"
      />

      <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, eventStatus === null && styles.filterChipSelected]} onPress={() => setEventStatus(null)}>
          <Text style={[styles.filterChipText, eventStatus === null && styles.filterChipTextSelected]}>All</Text>
        </Pressable>
        {EVENT_STATUSES.map((s) => (
          <Pressable key={s} style={[styles.filterChip, eventStatus === s && styles.filterChipSelected]} onPress={() => setEventStatus(s)}>
            <Text style={[styles.filterChipText, eventStatus === s && styles.filterChipTextSelected]}>{EVENT_STATUS_LABELS[s]}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load events.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.eventId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No events yet — add the first one.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerActions: { flexDirection: "row", gap: 10 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  newButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  newButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  search: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: "#e8edf3", backgroundColor: "#132540", marginBottom: 12, fontSize: 14,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  filterChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#132540" },
  filterChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  filterChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  filterChipTextSelected: { color: "#ff9a4d" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  eventDate: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  customerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  contact: { color: "#a7b7cb", fontSize: 13 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  meta: { color: "#6f83a0", fontSize: 12, marginTop: 4 },
  chevron: { color: "#6f83a0", fontSize: 20, marginLeft: 8 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
