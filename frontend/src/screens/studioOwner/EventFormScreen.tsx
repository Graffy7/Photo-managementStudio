import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "../../api/eventsApi";
import { paymentsApi } from "../../api/paymentsApi";
import { localDateString } from "../../utils/localDate";
import { lookupApis } from "../../api/lookupsApi";
import { EVENT_STATUS_LABELS, statusForDate, type EventHistoryPayment, type StudioEvent } from "../../types/event";
import { StatusPill, eventStatusTone } from "../../components/StatusPill";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { MiniTimePicker } from "../../components/MiniTimePicker";
import { LookupTypeField } from "../../components/LookupTypeField";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod, type PaymentStatus } from "../../types/payment";
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
  // Only "cancelled or not" is chosen here; otherwise the date decides the status.
  const [cancelled, setCancelled] = useState(event?.eventStatus === "Cancelled");
  const [fileLocation, setFileLocation] = useState(event?.fileLocation ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  // Missing required fields are pointed out once Save has been pressed.
  const [tried, setTried] = useState(false);

  const eventStatus = cancelled ? "Cancelled" : statusForDate(eventDate.trim() || localDateString(), localDateString());
  const budgetAmount = Number(budget) || 0;
  const advanceAmount = Number(advancePaid) || 0;

  // Editing: this event's payments, so a wrongly typed amount can be corrected here (and a new
  // payment added) instead of going to Payments. Typed amounts are kept per paymentId.
  const { data: history, isPending: paymentsLoading } = useQuery({
    queryKey: ["event-history", event?.eventId],
    queryFn: () => eventsApi.history(event!.eventId),
    enabled: isEdit,
  });
  const payments: EventHistoryPayment[] = useMemo(
    () => [...(history?.payments ?? [])].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate)),
    [history],
  );
  const [paymentEdits, setPaymentEdits] = useState<Record<number, string>>({});
  useEffect(() => {
    // Fill in only payments not seen yet, so a background reload never wipes what was typed.
    setPaymentEdits((m) => ({ ...Object.fromEntries(payments.map((p) => [p.paymentId, String(p.amount)])), ...m }));
  }, [payments]);
  const editedAmount = (p: EventHistoryPayment) => {
    const typed = paymentEdits[p.paymentId];
    return typed === undefined ? p.amount : Number(typed) || 0;
  };
  // Refunds/deductions (negative) stay as they are here; they need a reason, so they're changed under Payments.
  const changedPayments = payments.filter((p) => p.amount > 0 && editedAmount(p) !== p.amount);

  const mutation = useMutation({
    mutationFn: async () => {
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
      if (!isEdit) {
        return eventsApi.create(payload);
      }
      // Order matters, because the server checks every step against what is stored: lowered
      // payments first (so a lower total fits), then the event, then raised payments and the new
      // payment (so they fit under the new total).
      const savePayment = (p: EventHistoryPayment) => paymentsApi.update(p.paymentId, {
        customerId: event!.customerId,
        eventId: event!.eventId,
        amount: editedAmount(p),
        paymentDate: p.paymentDate.slice(0, 10),
        paymentMethod: p.paymentMethod as PaymentMethod,
        referenceNumber: p.referenceNumber ?? undefined,
        notes: p.notes ?? undefined,
        paymentStatus: p.paymentStatus as PaymentStatus,
      });
      for (const p of changedPayments.filter((x) => editedAmount(x) < x.amount)) await savePayment(p);
      // Say which version of the event these fields came from, so the save is refused if someone
      // else changed the event in the meantime (instead of overwriting their changes).
      const saved = await eventsApi.update(event!.eventId, { ...payload, rowVersion: event!.rowVersion });
      for (const p of changedPayments.filter((x) => editedAmount(x) > x.amount)) await savePayment(p);
      if (advanceAmount > 0) {
        await paymentsApi.create({
          customerId: event!.customerId,
          eventId: event!.eventId,
          amount: advanceAmount,
          paymentDate: localDateString(),
          paymentMethod: advanceMethod,
          paymentStatus: "Completed",
        });
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event-history"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      onDone();
    },
    onError: (err) => {
      // A step may have gone through before the failure; reload so the form shows what's stored.
      queryClient.invalidateQueries({ queryKey: ["event-history"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setError(extractErrorMessage(err, "Couldn't save the event. Please try again."));
    },
  });

  // New event: the advance being typed. Editing: the received payments as corrected in this form,
  // plus the new payment being added.
  const receivedEdited = payments.filter((p) => p.paymentStatus === "Completed").reduce((sum, p) => sum + editedAmount(p), 0);
  const paidBefore = isEdit ? (history ? receivedEdited : event!.amountPaid) : 0;
  const paidSoFar = paidBefore + advanceAmount;
  const balance = budgetAmount - paidSoFar;
  const advanceError = advanceAmount > 0 && advanceAmount > budgetAmount - paidBefore
    ? (budgetAmount <= 0 ? "Enter the total first."
      : isEdit ? `Only ${formatCurrency(Math.max(0, budgetAmount - paidBefore))} is still due on this event.`
      : "The advance can't be more than the total.")
    : null;
  const paymentErrors: Record<number, string> = {};
  for (const p of payments) {
    const typed = paymentEdits[p.paymentId];
    if (p.amount > 0 && typed !== undefined && !(Number(typed) > 0)) paymentErrors[p.paymentId] = "Enter an amount more than zero.";
  }

  // What's been paid sets a floor on the total (the server checks this too) - otherwise the balance
  // would go negative. Correct a payment below, or record a refund, to go lower.
  const totalError = isEdit && paidBefore > 0 && (budget.trim() === "" || budgetAmount < paidBefore)
    ? `The payments add up to ${formatCurrency(paidBefore)}, so the total can't be less than that. Correct a payment below, or record a refund under Payments.`
    : null;

  const customerError = tried && !customer ? "Choose the customer for this event." : null;
  const dateError = tried && !eventDate.trim() ? "Choose the event date." : null;
  const canSave = customer !== null && eventDate.trim().length > 0 && !advanceError && !totalError
    && Object.keys(paymentErrors).length === 0;

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

      <FormSection title="Money" description={isEdit ? "Change the total, correct a payment's amount, or add a payment received now." : undefined}>
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
          {(
            <Field label={isEdit ? "Add a payment now" : "Advance paid now"} hint={isEdit ? "Saved as received today." : undefined} error={advanceError} flex>
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
        {advanceAmount > 0 && !advanceError && (
          <Field label={isEdit ? "Payment paid by" : "Advance paid by"} required>
            <ChoiceChips
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              value={advanceMethod}
              onChange={setAdvanceMethod}
            />
          </Field>
        )}
        {isEdit && (paymentsLoading ? (
          <Text style={styles.paymentsNote}>Loading payments…</Text>
        ) : payments.length > 0 && (
          <View style={styles.payments}>
            <Text style={styles.paymentsTitle}>Payments received</Text>
            {payments.map((p) => {
              const refund = p.amount < 0;
              return (
                <View key={p.paymentId} style={styles.paymentRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.paymentWhen}>
                      {new Date(p.paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}{PAYMENT_METHOD_LABELS[p.paymentMethod as PaymentMethod] ?? p.paymentMethod}
                    </Text>
                    {p.paymentStatus !== "Completed" && <Text style={styles.paymentMeta}>{p.paymentStatus} - not counted as paid</Text>}
                    {refund && <Text style={styles.paymentMeta}>Refund · change it under Payments</Text>}
                    {paymentErrors[p.paymentId] && <Text style={styles.paymentError}>{paymentErrors[p.paymentId]}</Text>}
                  </View>
                  {refund ? (
                    <Text style={styles.paymentFixed}>{formatCurrency(p.amount)}</Text>
                  ) : (
                    <View style={styles.paymentInput}>
                      <TextField
                        invalid={!!paymentErrors[p.paymentId]}
                        value={paymentEdits[p.paymentId] ?? String(p.amount)}
                        onChangeText={(v) => setPaymentEdits((m) => ({ ...m, [p.paymentId]: v.replace(/[^0-9.]/g, "") }))}
                        keyboardType="numeric"
                        accessibilityLabel={`Amount of the payment on ${p.paymentDate.slice(0, 10)}`}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        {(budgetAmount > 0 || paidSoFar > 0) && (
          <View style={styles.money}>
            <Money label="Total" value={formatCurrency(budgetAmount)} />
            <Money label={isEdit ? "Paid" : "Advance"} value={formatCurrency(paidSoFar)} />
            <Money label={balance < 0 ? "Overpaid" : "Balance"} value={formatCurrency(Math.abs(balance))} tone={balance > 0 ? colors.warning : balance < 0 ? colors.danger : colors.success} />
          </View>
        )}
      </FormSection>

      <FormSection title="Status and notes">
        <Field label="Status">
          <View style={styles.statusRow}>
            <StatusPill label={EVENT_STATUS_LABELS[eventStatus]} tone={eventStatusTone(eventStatus)} />
            <Text style={styles.statusHint}>
              {cancelled
                ? "This event is cancelled."
                : "Set from the event date: Upcoming before the day, Ongoing on the day, Completed after it."}
            </Text>
          </View>
        </Field>
        <Field label="Is the event going ahead?">
          <ChoiceChips
            options={[{ value: "active", label: "Going ahead" }, { value: "cancelled", label: "Cancelled" }]}
            value={cancelled ? "cancelled" : "active"}
            onChange={(v) => setCancelled(v === "cancelled")}
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
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" },
  statusHint: { ...type.small, color: colors.textMuted, flex: 1, minWidth: 200 },
  moneyLabel: { ...type.caption, color: colors.textMuted },
  moneyValue: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  payments: { gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: space.md },
  paymentsTitle: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  paymentsNote: { ...type.small, color: colors.textMuted },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  paymentWhen: { ...type.small, fontWeight: "600", color: colors.text },
  paymentMeta: { ...type.caption, color: colors.textMuted },
  paymentError: { ...type.caption, color: colors.danger },
  paymentInput: { width: 140 },
  paymentFixed: { ...type.body, fontWeight: "700", color: colors.textMuted, width: 140, textAlign: "right", fontVariant: ["tabular-nums"] },
});
