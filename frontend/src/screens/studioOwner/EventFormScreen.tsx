import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "../../api/eventsApi";
import { lookupApis } from "../../api/lookupsApi";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, type EventStatus, type StudioEvent } from "../../types/event";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { MiniTimePicker } from "../../components/MiniTimePicker";
import { LookupTypeField } from "../../components/LookupTypeField";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../types/payment";

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

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
  const [advancePaid, setAdvancePaid] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>("Cash");
  const [eventStatus, setEventStatus] = useState<EventStatus>(event?.eventStatus ?? "Upcoming");
  const [fileLocation, setFileLocation] = useState(event?.fileLocation ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

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
        ...(!isEdit && advanceAmount > 0 ? { advancePaid: advanceAmount, advancePaymentMethod: advanceMethod } : {}),
        eventStatus,
        // Only a finished shoot has files to store, so the box is hidden (and anything typed into it
        // before the status changed is dropped) for every other status.
        fileLocation: eventStatus === "Completed" ? fileLocation.trim() || undefined : undefined,
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

  const budgetAmount = Number(budget) || 0;
  const advanceAmount = Number(advancePaid) || 0;
  // New event: the advance being typed. Editing: what's already been paid (payments are managed
  // from Payments/Calendar, so it's shown read-only here).
  const paidSoFar = isEdit ? event!.amountPaid : advanceAmount;
  const balance = budgetAmount - paidSoFar;
  const advanceError = !isEdit && advanceAmount > 0 && advanceAmount > budgetAmount
    ? (budgetAmount > 0 ? "Advance can't be more than the budget." : "Enter the budget first.")
    : null;

  const canSave = customer !== null && eventDate.trim().length > 0 && !advanceError;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit event" : "New event"}</Text>

      <Text style={styles.label}>Customer</Text>
      <CustomerPicker selected={customer} onSelect={setCustomer} />

      <LookupTypeField
        label="Event type"
        noun="event type"
        queryKey={["lookups", "eventTypes"]}
        api={lookupApis.eventTypes}
        selectedId={eventTypeId}
        onSelect={setEventTypeId}
      />

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
      <TextInput
        style={styles.input}
        value={budget}
        onChangeText={(v) => setBudget(v.replace(/[^0-9.]/g, ""))}
        placeholder="Optional"
        placeholderTextColor="#6f83a0"
        keyboardType="numeric"
      />

      {!isEdit && (
        <>
          <Text style={styles.label}>Advance paid</Text>
          <TextInput
            style={[styles.input, advanceError ? styles.inputInvalid : null]}
            value={advancePaid}
            onChangeText={(v) => setAdvancePaid(v.replace(/[^0-9.]/g, ""))}
            placeholder="Optional"
            placeholderTextColor="#6f83a0"
            keyboardType="numeric"
          />
          {advanceError ? <Text style={styles.error}>{advanceError}</Text> : null}
          {advanceAmount > 0 && !advanceError && (
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable key={m} style={[styles.chip, advanceMethod === m && styles.chipSelected]} onPress={() => setAdvanceMethod(m)}>
                  <Text style={[styles.chipText, advanceMethod === m && styles.chipTextSelected]}>{PAYMENT_METHOD_LABELS[m]}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {(budgetAmount > 0 || paidSoFar > 0) && (
        <View style={styles.moneyCard}>
          <View style={styles.moneyItem}>
            <Text style={styles.moneyLabel}>Budget</Text>
            <Text style={styles.moneyValue}>{formatCurrency(budgetAmount)}</Text>
          </View>
          <View style={styles.moneyItem}>
            <Text style={styles.moneyLabel}>Advance paid</Text>
            <Text style={styles.moneyValue}>{formatCurrency(paidSoFar)}</Text>
          </View>
          <View style={styles.moneyItem}>
            <Text style={styles.moneyLabel}>Balance</Text>
            <Text style={[styles.moneyValue, { color: balance > 0 ? "#f2bd5c" : "#4cc493" }]}>{formatCurrency(balance)}</Text>
          </View>
        </View>
      )}

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {EVENT_STATUSES.map((s) => (
          <Pressable key={s} style={[styles.chip, eventStatus === s && styles.chipSelected]} onPress={() => setEventStatus(s)}>
            <Text style={[styles.chipText, eventStatus === s && styles.chipTextSelected]}>{EVENT_STATUS_LABELS[s]}</Text>
          </Pressable>
        ))}
      </View>

      {eventStatus === "Completed" && (
        <>
          <Text style={styles.label}>File stored location</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={fileLocation}
            onChangeText={setFileLocation}
            placeholder="Where this event's photos and videos are kept, e.g. G:\Weddings\Rahul"
            placeholderTextColor="#6f83a0"
            multiline
            numberOfLines={2}
          />
        </>
      )}

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
  inputInvalid: { borderColor: "#ff7a72" },
  moneyCard: { flexDirection: "row", gap: 12, marginTop: 14, backgroundColor: "#132540", borderWidth: 1, borderColor: "#23405c", borderRadius: 10, padding: 14 },
  moneyItem: { flex: 1, gap: 2 },
  moneyLabel: { color: "#6f83a0", fontSize: 10.5 },
  moneyValue: { color: "#e8edf3", fontSize: 14, fontWeight: "700" },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
