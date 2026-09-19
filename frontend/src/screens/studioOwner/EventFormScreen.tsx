import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "../../api/eventsApi";
import { lookupApis } from "../../api/lookupsApi";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, type EventStatus, type StudioEvent } from "../../types/event";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { MiniTimePicker } from "../../components/MiniTimePicker";

interface Props {
  event?: StudioEvent;
  // Pre-fills the date when opened from a specific day (e.g. clicking "Add Event" with a date
  // already selected on the Calendar) — ignored in edit mode, still freely editable.
  initialEventDate?: string;
  onDone: () => void;
  onCancel: () => void;
}

export function EventFormScreen({ event, initialEventDate, onDone, onCancel }: Props) {
  const isEdit = !!event;
  const queryClient = useQueryClient();

  const [customer, setCustomer] = useState<PickedCustomer | null>(
    event ? { customerId: event.customerId, fullName: event.customerName, mobileNumber: event.customerMobileNumber } : null
  );
  const [eventTypeId, setEventTypeId] = useState<number | null>(event?.eventTypeId ?? null);
  const [eventDate, setEventDate] = useState(event?.eventDate?.slice(0, 10) ?? initialEventDate ?? "");
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [venueAddress, setVenueAddress] = useState(event?.venueAddress ?? "");
  const [budget, setBudget] = useState(event?.budget ? String(event.budget) : "");
  const [eventStatus, setEventStatus] = useState<EventStatus>(event?.eventStatus ?? "Upcoming");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: eventTypes } = useQuery({ queryKey: ["lookups", "eventTypes"], queryFn: lookupApis.eventTypes.getAll });

  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);

  const createType = useMutation({
    mutationFn: (name: string) => lookupApis.eventTypes.create({ name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["lookups", "eventTypes"] });
      setEventTypeId(created.id);
      setNewTypeName("");
      setAddingType(false);
    },
    onError: (err) => setTypeError(extractErrorMessage(err)),
  });

  // OK on an empty box just closes it, so there's no separate cancel control.
  const confirmNewType = () => {
    const name = newTypeName.trim();
    if (!name) {
      setAddingType(false);
      setTypeError(null);
      return;
    }
    createType.mutate(name);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        customerId: customer!.customerId,
        eventTypeId: eventTypeId ?? undefined,
        eventDate: eventDate.trim(),
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
        venue: venue.trim() || undefined,
        venueAddress: venueAddress.trim() || undefined,
        budget: budget.trim() ? Number(budget) : undefined,
        eventStatus,
        notes: notes.trim() || undefined,
      };
      return isEdit ? eventsApi.update(event!.eventId, payload) : eventsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave = customer !== null && eventDate.trim().length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit event" : "New event"}</Text>

      <Text style={styles.label}>Customer</Text>
      <CustomerPicker selected={customer} onSelect={setCustomer} />

      <Text style={styles.label}>Event type</Text>
      <View style={styles.chipRow}>
        <Pressable style={[styles.chip, eventTypeId === null && styles.chipSelected]} onPress={() => setEventTypeId(null)}>
          <Text style={[styles.chipText, eventTypeId === null && styles.chipTextSelected]}>None</Text>
        </Pressable>
        {(eventTypes ?? []).map((t) => (
          <Pressable key={t.id} style={[styles.chip, eventTypeId === t.id && styles.chipSelected]} onPress={() => setEventTypeId(t.id)}>
            <Text style={[styles.chipText, eventTypeId === t.id && styles.chipTextSelected]}>{t.name}</Text>
          </Pressable>
        ))}
        {!addingType && (
          <Pressable style={styles.chip} onPress={() => { setAddingType(true); setTypeError(null); }}>
            <Text style={styles.addChipText}>+ Add event type</Text>
          </Pressable>
        )}
      </View>
      {addingType && (
        <>
          <View style={styles.addTypeRow}>
            <TextInput
              style={[styles.input, styles.addTypeInput]}
              value={newTypeName}
              onChangeText={setNewTypeName}
              placeholder="Event type name"
              placeholderTextColor="#6f83a0"
              autoFocus
              onSubmitEditing={confirmNewType}
            />
            <Pressable style={styles.okButton} onPress={confirmNewType} disabled={createType.isPending}>
              {createType.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.okText}>OK</Text>}
            </Pressable>
          </View>
          {typeError ? <Text style={styles.error}>{typeError}</Text> : null}
        </>
      )}

      <Text style={styles.label}>Event date</Text>
      <MiniDatePicker variant="form" value={eventDate} onChange={setEventDate} placeholder="Select event date" />

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Text style={styles.label}>Start time</Text>
          <MiniTimePicker clearable value={startTime} onChange={setStartTime} placeholder="Start time" />
        </View>
        <View style={styles.timeField}>
          <Text style={styles.label}>End time</Text>
          <MiniTimePicker clearable value={endTime} onChange={setEndTime} placeholder="End time" />
        </View>
      </View>

      <Text style={styles.label}>Venue</Text>
      <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="Optional" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Venue address</Text>
      <TextInput style={styles.input} value={venueAddress} onChangeText={setVenueAddress} placeholder="Optional" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Budget</Text>
      <TextInput style={styles.input} value={budget} onChangeText={setBudget} placeholder="Optional" placeholderTextColor="#6f83a0" keyboardType="numeric" />

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {EVENT_STATUSES.map((s) => (
          <Pressable key={s} style={[styles.chip, eventStatus === s && styles.chipSelected]} onPress={() => setEventStatus(s)}>
            <Text style={[styles.chipText, eventStatus === s && styles.chipTextSelected]}>{EVENT_STATUS_LABELS[s]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        placeholderTextColor="#6f83a0"
        multiline
        numberOfLines={3}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create event"}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3", marginBottom: 20 },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#132540",
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  chipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#ff9a4d" },
  addChipText: { color: "#7fc0e6", fontSize: 12, fontWeight: "700" },
  addTypeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  addTypeInput: { flex: 1 },
  okButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  okText: { color: "#0d1826", fontWeight: "700", fontSize: 14 },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
