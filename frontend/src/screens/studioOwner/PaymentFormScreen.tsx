import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "../../api/paymentsApi";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_STATUSES, type Payment, type PaymentMethod, type PaymentStatus } from "../../types/payment";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { FormScreen, FormSection, FieldRow, Field, TextField, ChoiceChips, FormNote } from "../../ui/Form";
import { colors, radius, space, touch, type } from "../../ui/theme";

// Today's date on this device (not UTC - before 5:30am in India that would still be yesterday).
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface EventPaymentSummary {
  total: number | null;
  advancePaid: number;
  balance: number;
}

interface Props {
  payment?: Payment;
  // Pre-fills the form when opened from a specific event (e.g. "record payment" from an event's
  // Calendar/Day Board card) so the owner doesn't have to re-search for a customer they're
  // already looking at — still fully editable, just a head start.
  initialCustomer?: PickedCustomer;
  initialEventId?: number;
  initialAmount?: number;
  // Shows the event's Total / Paid so far / this payment / Balance right in this form, the balance
  // updating as the amount is typed - so the owner sees what will still be due after saving.
  eventSummary?: EventPaymentSummary;
  onDone: () => void;
  onCancel: () => void;
}

export function PaymentFormScreen({ payment, initialCustomer, initialEventId, initialAmount, eventSummary, onDone, onCancel }: Props) {
  const isEdit = !!payment;
  const queryClient = useQueryClient();

  const [customer, setCustomer] = useState<PickedCustomer | null>(
    payment ? { customerId: payment.customerId, fullName: payment.customerName, mobileNumber: payment.customerMobileNumber } : (initialCustomer ?? null)
  );
  // "Minus" is for refunds/corrections — it subtracts from what the customer has paid so far
  // (and so adds back to their balance) instead of adding to it. The typed Amount is always the
  // positive magnitude; this toggle controls its sign.
  const [mode, setMode] = useState<"add" | "minus">(payment && payment.amount < 0 ? "minus" : "add");
  const [amount, setAmount] = useState(payment ? String(Math.abs(payment.amount)) : (initialAmount ? String(initialAmount) : ""));
  const [paymentDate, setPaymentDate] = useState(payment?.paymentDate?.slice(0, 10) ?? localToday());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(payment?.paymentMethod ?? "Cash");
  const [referenceNumber, setReferenceNumber] = useState(payment?.referenceNumber ?? "");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(payment?.paymentStatus ?? "Completed");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const signedAmount = Number(amount || 0) * (mode === "minus" ? -1 : 1);
  // What will still be due once this payment is saved (negative = overpaid).
  const balanceAfter = eventSummary ? Math.round((eventSummary.balance - signedAmount) * 100) / 100 : 0;

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        customerId: customer!.customerId,
        eventId: payment?.eventId ?? initialEventId ?? undefined,
        amount: signedAmount,
        paymentDate: paymentDate.trim(),
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentStatus,
      };
      return isEdit ? paymentsApi.update(payment!.paymentId, payload) : paymentsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the payment. Please try again.")),
  });

  // The server enforces these too (it checks against the stored figures); showing them here just
  // saves a round trip. A payment can't be more than what's still due; a deduction needs a reason
  // and can't be more than what's been paid so far. Edits have a different baseline, so only the
  // server checks those.
  const overpayBy = !isEdit && mode === "add" && eventSummary && eventSummary.total !== null && eventSummary.total > 0
    ? Math.round((signedAmount - Math.max(0, eventSummary.balance)) * 100) / 100
    : 0;
  const overDeductBy = !isEdit && mode === "minus" && eventSummary
    ? Math.round((Math.abs(signedAmount) - eventSummary.advancePaid) * 100) / 100
    : 0;
  const needsReason = mode === "minus" && notes.trim().length < 3;
  // Money marked Completed has already been received, so it can't be dated after today. An expected
  // payment can be saved as Pending instead. (The server enforces the same rule.)
  const futureDateError = paymentStatus === "Completed" && paymentDate > localToday()
    ? "A received payment can't be dated in the future. If the money is only expected, choose Pending."
    : null;

  const customerError = tried && !customer ? "Choose who paid." : null;
  const amountError = tried && !(Number(amount) > 0) ? "Enter the amount." : null;
  const reasonError = tried && needsReason ? "Give a short reason for the deduction." : null;
  const canSave = customer !== null && Number(amount) > 0 && paymentDate.trim().length > 0
    && overpayBy <= 0 && overDeductBy <= 0 && !needsReason && !futureDateError;

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
      title={isEdit ? "Edit payment" : mode === "minus" ? "Record a deduction" : "Record a payment"}
      subtitle={isEdit ? payment!.customerName : undefined}
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : mode === "minus" ? "Record deduction" : "Record payment"}
      saving={mutation.isPending}
      error={error}
      above={eventSummary ? (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Money label="Total" value={eventSummary.total !== null ? formatCurrency(eventSummary.total) : "—"} />
            <Money label="Paid so far" value={formatCurrency(eventSummary.advancePaid)} />
            <Money
              label="This payment"
              value={signedAmount === 0 ? "—" : `${signedAmount < 0 ? "−" : "+"}${formatCurrency(Math.abs(signedAmount))}`}
              tone={signedAmount < 0 ? colors.danger : signedAmount > 0 ? colors.success : undefined}
            />
            <Money
              label={balanceAfter < 0 ? "Overpaid" : "Balance after"}
              value={formatCurrency(Math.abs(balanceAfter))}
              tone={balanceAfter > 0 ? colors.warning : balanceAfter < 0 ? colors.danger : colors.success}
            />
          </View>
          {signedAmount !== 0 && balanceAfter >= 0 && (
            <Text style={styles.summaryNote}>
              {balanceAfter > 0 ? `After this payment, ${formatCurrency(balanceAfter)} is still due.` : "This payment clears the balance."}
            </Text>
          )}
        </View>
      ) : undefined}
    >
      <FormSection title="Payment">
        <Field label="Customer" required error={customerError}>
          <CustomerPicker selected={customer} onSelect={(c) => { setCustomer(c); setError(null); }} />
        </Field>

        <Field
          label="Amount"
          required
          error={amountError}
          hint={mode === "minus" ? "A deduction takes money off what's been paid so far (for example a refund)." : null}
        >
          <View style={styles.amountRow}>
            <View style={styles.sign} accessibilityRole="radiogroup">
              {(["add", "minus"] as const).map((m) => {
                const on = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => { if (!on) { setAmount(""); setMode(m); } }}
                    style={[styles.signOption, on && (m === "add" ? styles.signAdd : styles.signMinus)]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.signText, on && { color: colors.text }]}>{m === "add" ? "+ Received" : "− Deduct"}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextField
              invalid={!!amountError}
              style={{ flex: 1, minWidth: 120 }}
              value={amount}
              onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, "")); setError(null); }}
              placeholder="10000"
              keyboardType="numeric"
              accessibilityLabel="Amount (required)"
            />
          </View>
        </Field>
        {overpayBy > 0 && (
          <FormNote tone="danger">
            This is {formatCurrency(overpayBy)} more than the {formatCurrency(Math.max(0, eventSummary!.balance))} still due on this event. If more is owed, update the event's total first.
          </FormNote>
        )}
        {overDeductBy > 0 && (
          <FormNote tone="danger">A deduction can't be more than what's been paid so far ({formatCurrency(eventSummary!.advancePaid)}).</FormNote>
        )}

        <FieldRow>
          <Field label="Date" required error={futureDateError} flex>
            <MiniDatePicker variant="form" value={paymentDate} onChange={setPaymentDate} placeholder="Select payment date" />
          </Field>
          <Field label="Reference number" hint="UPI / cheque / transaction ID" flex>
            <TextField value={referenceNumber} onChangeText={setReferenceNumber} placeholder="UPI-8821344" />
          </Field>
        </FieldRow>

        <Field label="Paid by" required>
          <ChoiceChips
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </Field>

        <Field label="Status" required hint="Completed = money received. Pending = still expected.">
          <ChoiceChips options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))} value={paymentStatus} onChange={setPaymentStatus} />
        </Field>

        {mode === "minus" ? (
          <Field label="Reason for the deduction" required error={reasonError}>
            <TextField invalid={!!reasonError} value={notes} onChangeText={setNotes} placeholder="Refund for the cancelled album" multiline numberOfLines={3} />
          </Field>
        ) : (
          <Field label="Notes">
            <TextField value={notes} onChangeText={setNotes} placeholder="Second instalment" multiline numberOfLines={3} />
          </Field>
        )}
      </FormSection>
    </FormScreen>
  );
}

function Money({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 110 }}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginTop: space.lg },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  summaryNote: { ...type.small, color: colors.textMuted, marginTop: space.md },
  moneyLabel: { ...type.caption, color: colors.textMuted },
  moneyValue: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  amountRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  sign: { flexDirection: "row", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control, overflow: "hidden" },
  signOption: { minHeight: touch, paddingHorizontal: space.md, justifyContent: "center" },
  signAdd: { backgroundColor: colors.successSoft },
  signMinus: { backgroundColor: colors.dangerSoft },
  signText: { ...type.small, fontWeight: "700", color: colors.textMuted },
});
