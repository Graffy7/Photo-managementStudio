import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "../../api/eventsApi";
import { workersApi } from "../../api/workersApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, type EventStatus, type StudioEvent } from "../../types/event";
import { StatusPill } from "../../components/StatusPill";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Ionicons } from "@expo/vector-icons";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: EventStatus): "good" | "bad" | "warn" | "neutral" {
  if (status === "Completed") return "good";
  if (status === "Cancelled") return "bad";
  return "neutral";
}

function WorkerPicker({ eventId, assignedWorkerIds, onDone }: { eventId: number; assignedWorkerIds: number[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: workers } = useQuery({
    queryKey: ["workers-active-picker"],
    queryFn: () => workersApi.search({ isActive: true, pageSize: 100 }),
  });

  const assign = useMutation({
    mutationFn: (workerId: number) => eventsApi.assignWorker(eventId, workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-workers", eventId] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const available = (workers?.items ?? []).filter((w) => !assignedWorkerIds.includes(w.workerId));

  return (
    <View style={styles.pickerCard}>
      <Text style={styles.smallLabel}>Assign a worker</Text>
      <View style={styles.chipRow}>
        {available.map((w) => (
          <Pressable key={w.workerId} style={styles.chip} onPress={() => assign.mutate(w.workerId)} disabled={assign.isPending}>
            <Text style={styles.chipText}>{w.fullName}{w.workerTypeName ? ` · ${w.workerTypeName}` : ""}</Text>
          </Pressable>
        ))}
        {available.length === 0 && <Text style={styles.teamHint}>No other active workers to assign.</Text>}
      </View>
      {error ? <Text style={styles.rowError}>{error}</Text> : null}
      <Pressable onPress={onDone} style={{ marginTop: 8 }}>
        <Text style={styles.cancelLink}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function EventTeamLine({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { data: crew, isLoading } = useQuery({
    queryKey: ["event-workers", eventId],
    queryFn: () => eventsApi.getAssignedWorkers(eventId),
  });

  const unassign = useMutation({
    mutationFn: (workerId: number) => eventsApi.unassignWorker(eventId, workerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-workers", eventId] }),
    onError: (err) => setRemoveError(extractErrorMessage(err)),
  });

  return (
    <View style={{ gap: 4 }}>
      {isLoading ? (
        <ActivityIndicator color="#7fc0e6" size="small" style={{ alignSelf: "flex-start" }} />
      ) : !crew || crew.length === 0 ? (
        <View style={styles.teamRow}>
          <Ionicons name="people-outline" size={12} color="#6f83a0" />
          <Text style={styles.teamHint}>No team assigned yet</Text>
        </View>
      ) : (
        <View style={styles.crewRow}>
          {crew.map((w) => (
            <View key={w.eventWorkerId} style={styles.crewChip}>
              <Text style={styles.crewChipText}>{w.workerName}{w.workerTypeName ? ` · ${w.workerTypeName}` : ""}</Text>
              <Pressable onPress={() => unassign.mutate(w.workerId)} disabled={unassign.isPending}>
                <Text style={styles.crewRemove}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {removeError ? <Text style={styles.rowError}>{removeError}</Text> : null}

      {showPicker ? (
        <WorkerPicker
          eventId={eventId}
          assignedWorkerIds={(crew ?? []).map((w) => w.workerId)}
          onDone={() => setShowPicker(false)}
        />
      ) : (
        <Pressable style={styles.assignTrigger} onPress={() => setShowPicker(true)}>
          <Text style={styles.assignTriggerText}>+ Assign worker</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EventListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (event: StudioEvent) => void; onView: (event: StudioEvent) => void }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [eventStatus, setEventStatus] = useState<EventStatus | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["events", search, eventStatus],
    queryFn: () => eventsApi.search({ search: search || undefined, eventStatus: eventStatus ?? undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const deleteEvent = useMutation({
    mutationFn: (eventId: number) => eventsApi.delete(eventId),
    onSuccess: () => {
      setPendingDeleteId(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-month"] });
    },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  });

  const renderItem = ({ item }: { item: StudioEvent }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.eventDate}>{formatDate(item.eventDate)}{item.startTime ? ` · ${item.startTime}` : ""}</Text>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <EventTeamLine eventId={item.eventId} />
        <Text style={styles.contact}>{item.customerMobileNumber}{item.venue ? ` · ${item.venue}` : ""}</Text>

        <View style={styles.pillRow}>
          <StatusPill label={EVENT_STATUS_LABELS[item.eventStatus]} tone={statusTone(item.eventStatus)} />
          {item.eventTypeName && <StatusPill label={item.eventTypeName} tone="neutral" />}
        </View>

        {item.budget !== null && (
          <View style={styles.financeRow}>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Total</Text>
              <Text style={styles.financeValue}>{formatCurrency(item.budget)}</Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Advance paid</Text>
              <Text style={styles.financeValue}>{formatCurrency(item.amountPaid)}</Text>
            </View>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>Balance</Text>
              <Text style={[styles.financeValue, { color: item.balance > 0 ? "#f2bd5c" : "#4cc493" }]}>
                {formatCurrency(item.balance)}
              </Text>
            </View>
          </View>
        )}
      </View>
      {pendingDeleteId === item.eventId ? (
        <View style={styles.deleteBox}>
          <Text style={styles.deleteText}>Delete this event?</Text>
          {deleteError ? <Text style={styles.rowError}>{deleteError}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => { setPendingDeleteId(null); setDeleteError(null); }}
              disabled={deleteEvent.isPending}
            >
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => deleteEvent.mutate(item.eventId)}
              disabled={deleteEvent.isPending}
            >
              {deleteEvent.isPending ? <ActivityIndicator color="#ff7a72" size="small" /> : <Text style={[styles.actionText, styles.actionTextDanger]}>Confirm Delete</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={() => onView(item)}>
            <Text style={styles.actionText}>View</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onEdit(item)}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => { setPendingDeleteId(item.eventId); setDeleteError(null); }}>
            <Text style={[styles.actionText, styles.actionTextDanger]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  eventDate: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  customerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  contact: { color: "#a7b7cb", fontSize: 13 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  teamHint: { color: "#6f83a0", fontSize: 12, fontStyle: "italic" },
  crewRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  crewChip: {
    flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#23405c", borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 10, backgroundColor: "#132540",
  },
  crewChipText: { color: "#e8edf3", fontSize: 11.5, fontWeight: "600" },
  crewRemove: { color: "#ff7a72", fontSize: 13, fontWeight: "700" },
  rowError: { color: "#ff7a72", fontSize: 12, marginTop: 2 },
  assignTrigger: { alignSelf: "flex-start" },
  assignTriggerText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  pickerCard: { marginTop: 4, borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 8, padding: 10, backgroundColor: "#0f1e30" },
  smallLabel: { fontSize: 11, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#0d1826" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  cancelLink: { color: "#ff7a72", fontSize: 12, fontWeight: "600" },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  financeRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 },
  financeItem: { gap: 1 },
  financeLabel: { color: "#6f83a0", fontSize: 10 },
  financeValue: { color: "#e8edf3", fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  actionTextDanger: { color: "#ff7a72" },
  actionBtnDanger: { borderColor: "#ff7a72", backgroundColor: "rgba(255, 122, 114, 0.14)" },
  deleteBox: { gap: 8, alignItems: "flex-end" },
  deleteText: { color: "#ff7a72", fontSize: 12, fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
