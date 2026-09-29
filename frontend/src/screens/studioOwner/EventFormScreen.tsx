import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
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
import { FormScreen, FormSection, FieldRow, Field, TextField, ChoiceChips, FormNote } from "../../ui/Form";
import { colors, radius, space, type } from "../../ui/theme";

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
  // Missing required fields are pointed out once Save has been pressed.
  const [tried, setTried] = useState(false);

  const budgetAmount = Number(budget) || 0;
  const advanceAmount = Number(advancePaid) || 0;

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
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the event. Please try again.")),
  });

  // New event: the advance being typed. Editing: what's already been paid (payments are managed
  // from Payments/Calendar, so it's shown read-only here).
  const paidSoFar = isEdit ? event!.amountPaid : advanceAmount;
  const balance = budgetAmount - paidSoFar;
  const advanceError = !isEdit && advanceAmount > 0 && advanceAmount > budgetAmount
    ? (budgetAmount > 0 ? "The advance can't be more than the total." : "Enter the total first.")
    : null;

  // What's already been paid sets a floor on the total (the server checks this too) - otherwise the
  // balance would go negative. Lowering it further needs a refund recorded first.
  const totalError = isEdit && event!.amountPaid > 0 && (budget.trim() === "" || budgetAmount < event!.amountPaid)
    ? `${formatCurrency(event!.amountPaid)} has already been paid, so the total can't be less than that. To lower it, record a refund first.`
    : null;

  const customerError = tried && !customer ? "Choose the customer for this event." : null;
  const dateError = tried && !eventDate.trim() ? "Choose the event date." : null;
  const canSave = customer !== null && eventDate.trim().length > 0 && !advanceError && !totalError;

  const submit = () => {
    setTried(true);
    if (!canSave) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <FormScreen
      title={isEdit ? "Edit event" : "New event"}
      subtitle={isEdit ? `${event!.eventTypeName ?? "Event"} · ${event!.customerName}` : "Customer and date are needed; everything else can be added later."}
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : "Create event"}
      saving={mutation.isPending}
      error={error}
    >
      <FormSection title="Customer and event">
        <Field label="Customer" required error={customerError}>
          <CustomerPicker selected={customer} onSelect={(c) => { setCustomer(c); setError(null); }} />
        </Field>
        <LookupTypeField
          label="Event type"
          noun="event type"
          queryKey={["lookups", "eventTypes"]}
          api={lookupApis.eventTypes}
          selectedId={eventTypeId}
          onSelect={setEventTypeId}
        />
      </FormSection>

      <FormSection title="Date and place">
        <Field label="Event date" required error={dateError}>
          <MiniDatePicker variant="form" value={eventDate} onChange={(v) => { setEventDate(v); setError(null); }} placeholder="Select event date" />
        </Field>
        <FieldRow>
          <Field label="Start time" flex>
            <MiniTimePicker clearable value={startTime} onChange={setStartTime} placeholder="Start time" />
          </Field>
          <Field label="End time" flex>
            <MiniTimePicker clearable value={endTime} onChange={setEndTime} placeholder="End time" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Venue" flex>
            <TextField value={venue} onChangeText={setVenue} placeholder="Grand Palace Hall" />
          </Field>
          <Field label="Venue address" flex>
            <TextField value={venueAddress} onChangeText={setVenueAddress} placeholder="Anna Nagar, Chennai" />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="Money" description={isEdit ? "Payments for this event are recorded under Payments." : undefined}>
        <FieldRow>
          <Field label="Total amount" error={totalError} flex>
            <TextField
              invalid={!!totalError}
              value={budget}
              onChangeText={(v) => setBudget(v.replace(/[^0-9.]/g, ""))}
              placeholder="85000"
              keyboardType="numeric"
            />
          </Field>
          {!isEdit && (
            <Field label="Advance paid now" error={advanceError} flex>
              <TextField
                invalid={!!advanceError}
                value={advancePaid}
                onChangeText={(v) => setAdvancePaid(v.replace(/[^0-9.]/g, ""))}
                placeholder="20000"
                keyboardType="numeric"
              />
            </Field>
          )}
        </FieldRow>
        {!isEdit && advanceAmount > 0 && !advanceError && (
          <Field label="Advance paid by" required>
            <ChoiceChips
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              value={advanceMethod}
              onChange={setAdvanceMethod}
            />
          </Field>
        )}
        {(budgetAmount > 0 || paidSoFar > 0) && (
          <View style={styles.money}>
            <Money label="Total" value={formatCurrency(budgetAmount)} />
            <Money label={isEdit ? "Paid so far" : "Advance"} value={formatCurrency(paidSoFar)} />
            <Money label={balance < 0 ? "Overpaid" : "Balance"} value={formatCurrency(Math.abs(balance))} tone={balance > 0 ? colors.warning : balance < 0 ? colors.danger : colors.success} />
          </View>
        )}
      </FormSection>

      <FormSection title="Status and notes">
        <Field label="Status" required>
          <ChoiceChips
            options={EVENT_STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_LABELS[s] }))}
            value={eventStatus}
            onChange={setEventStatus}
          />
        </Field>
        {eventStatus === "Completed" && (
          <Field label="Where the files are stored" hint="So anyone in the studio can find this event's photos and videos.">
            <TextField value={fileLocation} onChangeText={setFileLocation} placeholder="G:\Weddings\Rahul" multiline numberOfLines={2} />
          </Field>
        )}
        {eventStatus === "Cancelled" && isEdit && event!.amountPaid > 0 && (
          <FormNote>{formatCurrency(event!.amountPaid)} was paid for this event. Record a refund under Payments if it's being returned.</FormNote>
        )}
        <Field label="Notes">
          <TextField value={notes} onChangeText={setNotes} placeholder="Two photographers; drone at the reception" multiline numberOfLines={3} />
        </Field>
      </FormSection>
    </FormScreen>
  );
}

function Money({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  money: { flexDirection: "row", gap: space.md, backgroundColor: colors.page, borderRadius: radius.control, padding: space.md },
  moneyLabel: { ...type.caption, color: colors.textMuted },
  moneyValue: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
});
