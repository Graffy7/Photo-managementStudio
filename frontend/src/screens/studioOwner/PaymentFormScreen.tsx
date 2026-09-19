import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "../../api/paymentsApi";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_STATUSES, type Payment, type PaymentMethod, type PaymentStatus } from "../../types/payment";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";
import { MiniDatePicker } from "../../components/MiniDatePicker";

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
  // Shows the event's Total/Advance Paid/Balance so far right in this form — so the owner can see
  // what they're recording against without leaving to check the event first.
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
  const [paymentDate, setPaymentDate] = useState(payment?.paymentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(payment?.paymentMethod ?? "Cash");
  const [referenceNumber, setReferenceNumber] = useState(payment?.referenceNumber ?? "");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(payment?.paymentStatus ?? "Completed");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const signedAmount = Number(amount || 0) * (mode === "minus" ? -1 : 1);

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
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave = customer !== null && Number(amount) > 0 && paymentDate.trim().length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit payment" : "New payment"}</Text>

      {eventSummary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>{eventSummary.total !== null ? formatCurrency(eventSummary.total) : "—"}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Advance paid</Text>
              <Text style={styles.summaryValue}>{formatCurrency(eventSummary.advancePaid)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance</Text>
              <Text style={[styles.summaryValue, { color: eventSummary.balance > 0 ? "#f2bd5c" : "#4cc493" }]}>
                {formatCurrency(eventSummary.balance)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Text style={styles.label}>Customer</Text>
      <CustomerPicker selected={customer} onSelect={setCustomer} />

      <Text style={styles.label}>Amount</Text>
      <View style={styles.amountRow}>
        <Pressable
          style={[styles.signButton, mode === "add" && styles.signButtonAddActive]}
          onPress={() => { if (mode !== "add") setAmount(""); setMode("add"); }}
        >
          <Text style={[styles.signButtonText, mode === "add" && styles.signButtonTextActive]}>+ Add</Text>
        </Pressable>
        <Pressable
          style={[styles.signButton, mode === "minus" && styles.signButtonMinusActive]}
          onPress={() => { if (mode !== "minus") setAmount(""); setMode("minus"); }}
        >
          <Text style={[styles.signButtonText, mode === "minus" && styles.signButtonTextActive]}>− Minus</Text>
        </Pressable>
        <TextInput
          style={[styles.input, styles.amountInput]}
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
          placeholder="Enter amount"
          placeholderTextColor="#6f83a0"
          keyboardType="numeric"
        />
      </View>
      {mode === "minus" && (
        <Text style={styles.minusHint}>This subtracts from what's been paid so far (e.g. a refund or correction).</Text>
      )}

      <Text style={styles.label}>Payment date</Text>
      <MiniDatePicker variant="form" value={paymentDate} onChange={setPaymentDate} placeholder="Select payment date" />

      <Text style={styles.label}>Payment method</Text>
      <View style={styles.chipRow}>
        {PAYMENT_METHODS.map((m) => (
          <Pressable key={m} style={[styles.chip, paymentMethod === m && styles.chipSelected]} onPress={() => setPaymentMethod(m)}>
            <Text style={[styles.chipText, paymentMethod === m && styles.chipTextSelected]}>{PAYMENT_METHOD_LABELS[m]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Reference number</Text>
      <TextInput style={styles.input} value={referenceNumber} onChangeText={setReferenceNumber} placeholder="Optional" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {PAYMENT_STATUSES.map((s) => (
          <Pressable key={s} style={[styles.chip, paymentStatus === s && styles.chipSelected]} onPress={() => setPaymentStatus(s)}>
            <Text style={[styles.chipText, paymentStatus === s && styles.chipTextSelected]}>{s}</Text>
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
          {mutation.isPending ? (
            <ActivityIndicator color="#0d1826" />
          ) : (
            <Text style={styles.saveText}>{isEdit ? "Save changes" : mode === "minus" ? "Record deduction" : "Record payment"}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3", marginBottom: 20 },
  summaryCard: { backgroundColor: "#132540", borderWidth: 1, borderColor: "#23405c", borderRadius: 10, padding: 14, marginBottom: 18 },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryItem: { flex: 1, gap: 2 },
  summaryLabel: { color: "#6f83a0", fontSize: 10.5 },
  summaryValue: { color: "#e8edf3", fontSize: 14, fontWeight: "700" },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#132540",
  },
  amountRow: { flexDirection: "row", gap: 8 },
  amountInput: { flex: 1 },
  signButton: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center", backgroundColor: "#132540",
  },
  signButtonAddActive: { borderColor: "#4cc493", backgroundColor: "rgba(76, 196, 147, 0.14)" },
  signButtonMinusActive: { borderColor: "#ff7a72", backgroundColor: "rgba(255, 122, 114, 0.14)" },
  signButtonText: { color: "#a7b7cb", fontSize: 13, fontWeight: "700" },
  signButtonTextActive: { color: "#e8edf3" },
  minusHint: { color: "#ff7a72", fontSize: 11, marginTop: 6 },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  chipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#ff9a4d" },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
