import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { customersApi } from "../api/customersApi";
import { eventsApi } from "../api/eventsApi";
import { workersApi } from "../api/workersApi";
import { extractErrorMessage } from "../api/errorMessage";
import type { CustomerEventSummary } from "../types/customer";
import { StatusPill } from "./StatusPill";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: string): "good" | "bad" | "warn" | "neutral" {
  if (status === "Completed") return "good";
  if (status === "Cancelled") return "bad";
  return "neutral";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
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
        {available.length === 0 && <Text style={styles.hint}>No other active workers to assign.</Text>}
      </View>
      {error ? <Text style={styles.rowError}>{error}</Text> : null}
      <Pressable onPress={onDone} style={{ marginTop: 10 }}>
        <Text style={styles.cancelLink}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function CrewSection({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { data: crew, isPending } = useQuery({
    queryKey: ["event-workers", eventId],
    queryFn: () => eventsApi.getAssignedWorkers(eventId),
  });

  const unassign = useMutation({
    mutationFn: (workerId: number) => eventsApi.unassignWorker(eventId, workerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-workers", eventId] }),
    onError: (err) => setRemoveError(extractErrorMessage(err)),
  });

  return (
    <View>
      <Text style={styles.fieldLabel}>Team assigned</Text>
      {isPending ? (
        <ActivityIndicator color="#7fc0e6" size="small" style={{ marginTop: 6, alignSelf: "flex-start" }} />
      ) : !crew || crew.length === 0 ? (
        !showPicker && <Text style={styles.hint}>No one assigned yet.</Text>
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
          <Text style={styles.assignTriggerText}>+ Assign photographer / videographer</Text>
        </Pressable>
      )}
    </View>
  );
}

function EventNotesSection({ customerId, eventId, notes }: { customerId: number; eventId: number; notes: string | null }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (value: string) => eventsApi.updateNotes(eventId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-events", customerId] });
      setEditing(false);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  if (editing) {
    return (
      <View style={styles.notesEditCard}>
        <TextInput
          style={styles.notesInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a note about this event..."
          placeholderTextColor="#6f83a0"
          multiline
          numberOfLines={3}
          autoFocus
        />
        {error ? <Text style={styles.rowError}>{error}</Text> : null}
        <View style={styles.notesEditActions}>
          <Pressable onPress={() => { setDraft(notes ?? ""); setEditing(false); setError(null); }} disabled={mutation.isPending}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => mutation.mutate(draft.trim())} disabled={mutation.isPending}>
            {mutation.isPending ? <ActivityIndicator color="#7fc0e6" size="small" /> : <Text style={styles.saveNoteLink}>Save note</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable style={styles.notesRow} onPress={() => { setDraft(notes ?? ""); setEditing(true); setError(null); }}>
      <Ionicons name="document-text-outline" size={12} color="#6f83a0" />
      {notes ? (
        <Text style={styles.notesText} numberOfLines={2}>{notes}</Text>
      ) : (
        <Text style={styles.notesPlaceholder}>Add a note…</Text>
      )}
      <Ionicons name="pencil-outline" size={11} color="#7fc0e6" style={{ marginLeft: 4 }} />
    </Pressable>
  );
}

function EventRow({ event, customerId, onViewEvent }: { event: CustomerEventSummary; customerId: number; onViewEvent: (eventId: number) => void }) {
  return (
    <View style={styles.eventRow}>
      <View style={styles.eventTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTitle}>{event.eventTypeName ?? "Event"}</Text>
          <Text style={styles.eventDate}>{formatDate(event.eventDate)}</Text>
        </View>
        <StatusPill label={event.eventStatus} tone={statusTone(event.eventStatus)} />
        {/* Opens the event's full record: every quotation version and PDF, payments, crew. */}
        <Pressable style={styles.viewButton} onPress={() => onViewEvent(event.eventId)} accessibilityRole="button">
          <Text style={styles.viewButtonText}>View</Text>
        </Pressable>
      </View>

      <View style={styles.eventMetaRow}>
        <Ionicons name="time-outline" size={13} color="#6f83a0" />
        <Text style={styles.eventMetaText}>
          {event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}` : "No time set"}
        </Text>
        <Ionicons name="location-outline" size={13} color="#6f83a0" style={{ marginLeft: 12 }} />
        <Text style={styles.eventMetaText}>{event.venue ?? "No venue set"}</Text>
      </View>

      <EventNotesSection customerId={customerId} eventId={event.eventId} notes={event.notes} />

      <View style={styles.eventFinanceGrid}>
        {/* Budget stays on show because the balance beside it is budget minus paid; the accepted
            quotation's total sits next to it rather than replacing it, so the row adds up. */}
        <Field label="Budget" value={event.budget !== null ? formatCurrency(event.budget) : "—"} />
        {event.approvedAmount !== null && (
          <Field label="Approved amount" value={formatCurrency(event.approvedAmount)} />
        )}
        <Field label="Advance paid" value={formatCurrency(event.amountPaid)} />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{event.balance < 0 ? "Overpaid" : "Balance"}</Text>
          <Text style={[styles.fieldValue, { color: event.balance === 0 ? "#4cc493" : "#f2bd5c" }]}>{formatCurrency(Math.abs(event.balance))}</Text>
        </View>
        {event.quotationCount > 0 && (
          <Field label="Quotations" value={`${event.quotationCount} version${event.quotationCount === 1 ? "" : "s"}`} />
        )}
      </View>

      <View style={styles.crewCard}>
        <CrewSection eventId={event.eventId} />
      </View>
    </View>
  );
}

export function CustomerEventsList({ customerId }: { customerId: number }) {
  const navigation = useNavigation<any>();
  const openEvent = (eventId: number) => navigation.navigate("Events", { eventId });

  const { data, isPending, isError } = useQuery({
    queryKey: ["customer-events", customerId],
    queryFn: () => customersApi.getEvents(customerId),
  });

  if (isPending) {
    return <ActivityIndicator color="#7fc0e6" style={{ marginVertical: 10 }} />;
  }

  if (isError) {
    return <Text style={styles.empty}>Couldn't load this customer's events.</Text>;
  }

  if (!data || data.length === 0) {
    return <Text style={styles.empty}>No events booked yet.</Text>;
  }

  return (
    <View style={{ gap: 14 }}>
      {data.map((event, i) => (
        <View key={event.eventId}>
          {i > 0 && <View style={styles.eventSeparator} />}
          <EventRow event={event} customerId={customerId} onViewEvent={openEvent} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#a7b7cb", fontSize: 14, lineHeight: 20 },
  viewButton: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#0f1e30" },
  viewButtonText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  field: { minWidth: 120, gap: 3 },
  fieldLabel: { color: "#6f83a0", fontSize: 11 },
  fieldValue: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },

  eventRow: { gap: 10 },
  eventSeparator: { height: 1, backgroundColor: "#1b2c42", marginBottom: 14 },
  eventTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eventTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  eventDate: { color: "#7fc0e6", fontSize: 12, fontWeight: "600", marginTop: 2 },
  eventMetaRow: { flexDirection: "row", alignItems: "center" },
  eventMetaText: { color: "#a7b7cb", fontSize: 12, marginLeft: 4 },
  notesRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  notesText: { color: "#6f83a0", fontSize: 11.5, fontStyle: "italic", flex: 1, lineHeight: 16 },
  notesPlaceholder: { color: "#7fc0e6", fontSize: 11.5, fontStyle: "italic", flex: 1, lineHeight: 16 },
  notesEditCard: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, padding: 10, backgroundColor: "#0f1e30", gap: 6 },
  notesInput: {
    color: "#e8edf3", fontSize: 12.5, lineHeight: 17, minHeight: 54, textAlignVertical: "top",
    borderWidth: 1, borderColor: "#23405c", borderRadius: 6, padding: 8, backgroundColor: "#0d1826",
  },
  notesEditActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16 },
  saveNoteLink: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  eventFinanceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, backgroundColor: "#0f1e30", borderRadius: 8, padding: 12 },

  crewCard: { backgroundColor: "#0f1e30", borderRadius: 8, padding: 12 },
  smallLabel: { fontSize: 11, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  hint: { color: "#6f83a0", fontSize: 12, marginTop: 6 },
  crewRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
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
