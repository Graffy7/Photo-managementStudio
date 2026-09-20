import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { photoSelectionApi } from "../../api/photoSelectionApi";
import { StatusPill } from "../../components/StatusPill";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import type { CompletedEventGallery, GalleryState } from "../../types/photoSelection";

export const STATE_LABELS: Record<GalleryState, string> = {
  NoPhotos: "No photos yet",
  NeedToSend: "Need to send",
  Pending: "Link sent",
  Submitted: "Submitted",
  Locked: "Locked",
  Expired: "Expired",
};

export function stateTone(state: GalleryState): "good" | "bad" | "warn" | "neutral" {
  if (state === "Submitted") return "good";
  if (state === "Expired") return "bad";
  if (state === "NeedToSend") return "warn";
  return "neutral";
}

const FILTERS: { key: GalleryState | "All"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "NeedToSend", label: "Need to send" },
  { key: "Pending", label: "Link sent" },
  { key: "Submitted", label: "Submitted" },
  { key: "Locked", label: "Locked" },
  { key: "Expired", label: "Expired" },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

// Completed events and where each one stands with its customer photo selection. Tapping one opens
// (creating, the first time) that event's gallery.
export function PhotoSelectionListScreen({ onOpen }: { onOpen: (eventId: number) => void }) {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<GalleryState | "All">("All");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["photo-gallery-events", search],
    queryFn: () => photoSelectionApi.completedEvents({ search: search || undefined, page: 1, pageSize: 100 }),
  });
  useRefetchOnFocus(refetch);

  const items = useMemo(
    () => (data?.items ?? []).filter((e) => filter === "All" || e.state === filter),
    [data, filter]
  );

  const renderItem = ({ item }: { item: CompletedEventGallery }) => (
    <Pressable style={styles.row} onPress={() => onOpen(item.eventId)}>
      <View style={styles.rowMain}>
        <Text style={styles.date}>{formatDate(item.eventDate)}{item.eventTypeName ? ` · ${item.eventTypeName}` : ""}</Text>
        <Text style={styles.customer}>{item.customerName}</Text>
        {!!item.venue && <Text style={styles.venue}>{item.venue}</Text>}
        <View style={styles.pillRow}>
          <StatusPill label={STATE_LABELS[item.state]} tone={stateTone(item.state)} />
        </View>
      </View>
      <View style={styles.rowEnd}>
        {item.photoCount > 0 && (
          <Text style={styles.progress}>{item.selectedCount} / {item.photoCount} selected</Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Photo Selection</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} completed events</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Home</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by customer or venue"
        placeholderTextColor="#6f83a0"
      />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} style={[styles.chip, filter === f.key && styles.chipSelected]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextSelected]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load events.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.eventId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {(data?.totalCount ?? 0) === 0
                ? "No completed events yet. Photo selection opens once an event is marked Completed."
                : "No events in this view."}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  search: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: "#e8edf3", backgroundColor: "#132540", marginBottom: 12, fontSize: 14,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#132540" },
  chipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#ff9a4d" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, gap: 12 },
  rowMain: { flex: 1, gap: 3 },
  date: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  customer: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  venue: { color: "#a7b7cb", fontSize: 13 },
  pillRow: { flexDirection: "row", marginTop: 4 },
  rowEnd: { flexDirection: "row", alignItems: "center", gap: 10 },
  progress: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chevron: { color: "#6f83a0", fontSize: 20 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
