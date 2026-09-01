import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionPlansApi } from "../../api/subscriptionPlansApi";
import { subscriptionsApi } from "../../api/subscriptionsApi";
import { extractErrorMessage } from "../../api/errorMessage";
import type { Studio } from "../../types/studio";

const PAYMENT_METHODS = ["Cash", "UPI", "BankTransfer", "Card", "Other"];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export function RenewSubscriptionScreen({ studio, onDone, onCancel }: { studio: Studio; onDone: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const { data: plans } = useQuery({ queryKey: ["subscription-plans"], queryFn: subscriptionPlansApi.getActive });

  const [subscriptionPlanId, setSubscriptionPlanId] = useState<number | null>(studio.subscriptionPlanId);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subscriptionPlanId === null && plans && plans.length > 0) {
      setSubscriptionPlanId(plans[0].subscriptionPlanId);
    }
  }, [plans, subscriptionPlanId]);

  const mutation = useMutation({
    mutationFn: () =>
      subscriptionsApi.renew(studio.studioId, {
        subscriptionPlanId: subscriptionPlanId ?? undefined,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studios"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Renew subscription</Text>
      <Text style={styles.subtitle}>{studio.studioName}</Text>

      <View style={styles.currentBox}>
        <Text style={styles.currentLabel}>Current plan</Text>
        <Text style={styles.currentValue}>{studio.planName ?? "—"}</Text>
        <Text style={styles.currentMeta}>Renews {formatDate(studio.subscriptionEndDate)}</Text>
      </View>

      <Text style={styles.label}>Plan</Text>
      <View style={styles.chipRow}>
        {(plans ?? []).map((plan) => {
          const selected = plan.subscriptionPlanId === subscriptionPlanId;
          return (
            <Pressable
              key={plan.subscriptionPlanId}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setSubscriptionPlanId(plan.subscriptionPlanId)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{plan.planName}</Text>
              <Text style={[styles.chipSubtext, selected && styles.chipSubtextSelected]}>
                ₹{plan.price.toLocaleString("en-IN")}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Payment method</Text>
      <View style={styles.chipRow}>
        {PAYMENT_METHODS.map((method) => {
          const selected = method === paymentMethod;
          return (
            <Pressable key={method} style={[styles.methodChip, selected && styles.chipSelected]} onPress={() => setPaymentMethod(method)}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{method}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Reference number</Text>
      <TextInput
        style={styles.input}
        value={referenceNumber}
        onChangeText={setReferenceNumber}
        placeholder="Optional — transaction ID, cheque number, etc."
        placeholderTextColor="#6f83a0"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>Record renewal</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 4, marginBottom: 18 },
  currentBox: {
    backgroundColor: "#132540", borderRadius: 10, borderWidth: 1, borderColor: "#23405c",
    padding: 16, marginBottom: 22,
  },
  currentLabel: { fontSize: 11, color: "#6f83a0", textTransform: "uppercase", letterSpacing: 0.5 },
  currentValue: { fontSize: 18, fontWeight: "700", color: "#e8edf3", marginTop: 2 },
  currentMeta: { fontSize: 12, color: "#a7b7cb", marginTop: 2 },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 8, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  chip: {
    flexGrow: 1, minWidth: 100, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: "#132540",
  },
  methodChip: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14,
    backgroundColor: "#132540",
  },
  chipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.12)" },
  chipText: { color: "#e8edf3", fontWeight: "600", fontSize: 13 },
  chipTextSelected: { color: "#ff9a4d" },
  chipSubtext: { color: "#6f83a0", fontSize: 11, marginTop: 2 },
  chipSubtextSelected: { color: "#ffb877" },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#132540",
  },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 26 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
