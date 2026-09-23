import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dayBoardApi } from "../../api/dayBoardApi";
import { workersApi } from "../../api/workersApi";
import type { DayBoardEvent } from "../../types/dayBoard";
import { StatusPill } from "../../components/StatusPill";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { extractErrorMessage } from "../../api/errorMessage";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: string): "good" | "bad" | "warn" | "neutral" {
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
    mutationFn: (workerId: number) => dayBoardApi.assignWorker(eventId, workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-board"] });
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
            <Text style={styles.chipText}>{w.fullName}</Text>
          </Pressable>
        ))}
        {available.length === 0 && <Text style={styles.hint}>No other active workers to assign.</Text>}
      </View>
      {error ? <Text style={styles.rowError}>{error}</Text> : null}
      <Pressable onPress={onDone} style={{ marginTop: 10 }}>
        <Text style={styles.cancelLink}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function EventCard({ event }: { event: DayBoardEvent }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const unassign = useMutation({
    mutationFn: (workerId: number) => dayBoardApi.unassignWorker(event.eventId, workerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["day-board"] }),
    onError: (err) => setRemoveError(extractErrorMessage(err)),
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.time}>{event.startTime ?? "No time set"}{event.endTime ? ` – ${event.endTime}` : ""}</Text>
        <StatusPill label={event.eventStatus} tone={statusTone(event.eventStatus)} />
      </View>

      <Text style={styles.customerName}>{event.customerName}</Text>
      <Text style={styles.contact}>{event.customerMobileNumber}</Text>

      {(event.venue || event.venueAddress) && (
        <Text style={styles.venue}>{[event.venue, event.venueAddress].filter(Boolean).join(" · ")}</Text>
      )}

      <View style={styles.pillRow}>
        {event.eventTypeName && <StatusPill label={event.eventTypeName} tone="neutral" />}
      </View>

      {event.budget !== null && (
        <View style={styles.financeRow}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Total</Text>
            <Text style={styles.financeValue}>{formatCurrency(event.budget)}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Advance paid</Text>
            <Text style={styles.financeValue}>{formatCurrency(event.amountPaid)}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Balance</Text>
            <Text style={[styles.financeValue, { color: event.balance > 0 ? "#f2bd5c" : "#4cc493" }]}>
              {formatCurrency(event.balance)}
            </Text>
          </View>
        </View>
      )}

      {event.notes ? <Text style={styles.notes}>{event.notes}</Text> : null}

      <Text style={styles.smallLabel}>Crew</Text>
      {event.workers.length === 0 && !showPicker ? (
        <Text style={styles.hint}>No one assigned yet.</Text>
      ) : (
        <View style={styles.crewRow}>
          {event.workers.map((w) => (
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
          eventId={event.eventId}
          assignedWorkerIds={event.workers.map((w) => w.workerId)}
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

export function DayBoardScreen() {
  const navigation = useNavigation<any>();
  const [date, setDate] = useState(todayUtc());

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["day-board", date],
    queryFn: () => dayBoardApi.getDayBoard(date),
  });
  useRefetchOnFocus(refetch);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Day board</Text>
          <Text style={styles.subtitle}>{data ? formatDateLabel(date) : ""}</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Home</Text>
        </Pressable>
      </View>

      <View style={styles.dateNav}>
        <Pressable style={styles.navButton} onPress={() => setDate((d) => shiftDate(d, -1))}>
          <Text style={styles.navButtonText}>‹ Prev</Text>
        </Pressable>
        <View style={styles.datePickerSlot}>
          <MiniDatePicker value={date} onChange={(d) => d && setDate(d)} />
        </View>
        <Pressable style={styles.navButton} onPress={() => setDate(todayUtc())}>
          <Text style={styles.navButtonText}>Today</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={() => setDate((d) => shiftDate(d, 1))}>
          <Text style={styles.navButtonText}>Next ›</Text>
        </Pressable>
      </View>

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Couldn't load the day board.</Text>
      ) : data.events.length === 0 ? (
        <Text style={styles.empty}>No events scheduled for this day.</Text>
      ) : (
        data.events.map((event) => <EventCard key={event.eventId} event={event} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  dateNav: { flexDirection: "row", gap: 8, marginBottom: 20 },
  navButton: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#132540" },
  navButtonText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  datePickerSlot: { flex: 1, justifyContent: "center" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
  card: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", padding: 16, marginBottom: 14, gap: 4,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { color: "#ff9a4d", fontSize: 13, fontWeight: "700" },
  customerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600", marginTop: 4 },
  contact: { color: "#a7b7cb", fontSize: 13 },
  venue: { color: "#a7b7cb", fontSize: 13 },
  notes: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  financeRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  financeItem: { gap: 1 },
  financeLabel: { color: "#6f83a0", fontSize: 10 },
  financeValue: { color: "#e8edf3", fontSize: 12, fontWeight: "700" },
  smallLabel: { fontSize: 11, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  hint: { color: "#6f83a0", fontSize: 12 },
  crewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  crewChip: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#23405c", borderRadius: 100,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#0d1826",
  },
  crewChipText: { color: "#e8edf3", fontSize: 12, fontWeight: "600" },
  crewRemove: { color: "#ff7a72", fontSize: 14, fontWeight: "700" },
  rowError: { color: "#ff7a72", fontSize: 12, marginTop: 4 },
  assignTrigger: { marginTop: 10, alignSelf: "flex-start" },
  assignTriggerText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  pickerCard: { marginTop: 10, borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 8, padding: 12, backgroundColor: "#0d1826" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  cancelLink: { color: "#ff7a72", fontSize: 12, fontWeight: "600" },
});
