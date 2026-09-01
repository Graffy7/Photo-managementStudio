import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "../../api/paymentsApi";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_STATUSES, type Payment, type PaymentMethod, type PaymentStatus } from "../../types/payment";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerPicker, type PickedCustomer } from "../../components/CustomerPicker";

interface Props {
  payment?: Payment;
  onDone: () => void;
  onCancel: () => void;
}

export function PaymentFormScreen({ payment, onDone, onCancel }: Props) {
  const isEdit = !!payment;
  const queryClient = useQueryClient();

  const [customer, setCustomer] = useState<PickedCustomer | null>(
    payment ? { customerId: payment.customerId, fullName: payment.customerName, mobileNumber: payment.customerMobileNumber } : null
  );
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "");
  const [paymentDate, setPaymentDate] = useState(payment?.paymentDate?.slice(0, 10) ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(payment?.paymentMethod ?? "Cash");
  const [referenceNumber, setReferenceNumber] = useState(payment?.referenceNumber ?? "");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(payment?.paymentStatus ?? "Completed");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        customerId: customer!.customerId,
        amount: Number(amount),
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

      <Text style={styles.label}>Customer</Text>
      <CustomerPicker selected={customer} onSelect={setCustomer} />

      <Text style={styles.label}>Amount</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="40000" placeholderTextColor="#6f83a0" keyboardType="numeric" />

      <Text style={styles.label}>Payment date</Text>
      <TextInput style={styles.input} value={paymentDate} onChangeText={setPaymentDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6f83a0" />

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
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Record payment"}</Text>}
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
