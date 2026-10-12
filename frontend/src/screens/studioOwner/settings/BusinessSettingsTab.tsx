import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#8a9cb6"
        keyboardType={keyboardType}
      />
    </View>
  );
}

export function BusinessSettingsTab() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["business-settings"], queryFn: settingsApi.getBusinessSettings });

  const [quotationValidityDays, setQuotationValidityDays] = useState("15");
  const [currency, setCurrency] = useState("INR");
  const [taxPercentage, setTaxPercentage] = useState("0");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [advancePaymentPercentage, setAdvancePaymentPercentage] = useState("0");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setQuotationValidityDays(String(data.quotationValidityDays));
    setCurrency(data.currency);
    setTaxPercentage(String(data.taxPercentage));
    setPaymentTerms(data.paymentTerms);
    setAdvancePaymentPercentage(String(data.advancePaymentPercentage));
    setDateFormat(data.dateFormat);
    setTimeFormat(data.timeFormat);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updateBusinessSettings({
        quotationValidityDays: Number(quotationValidityDays) || 0,
        currency: currency.trim(),
        taxPercentage: Number(taxPercentage) || 0,
        paymentTerms: paymentTerms.trim(),
        advancePaymentPercentage: Number(advancePaymentPercentage) || 0,
        dateFormat: dateFormat.trim(),
        timeFormat: timeFormat.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-settings"] });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  if (isPending) {
    return <ActivityIndicator color="#8cc8f0" style={{ marginTop: 40 }} />;
  }

  return (
    <View>
      <View style={styles.row}>
        <Field label="Default quotation validity (days)" value={quotationValidityDays} onChangeText={setQuotationValidityDays} keyboardType="numeric" />
        <Field label="Currency" value={currency} onChangeText={setCurrency} />
      </View>
      <View style={styles.row}>
        <Field label="Tax / GST percentage" value={taxPercentage} onChangeText={setTaxPercentage} keyboardType="numeric" />
        <Field label="Default advance payment (%)" value={advancePaymentPercentage} onChangeText={setAdvancePaymentPercentage} keyboardType="numeric" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Default payment terms</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={paymentTerms}
          onChangeText={setPaymentTerms}
          placeholder="e.g. 50% advance, balance on delivery"
          placeholderTextColor="#8a9cb6"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.row}>
        <Field label="Date format" value={dateFormat} onChangeText={setDateFormat} />
        <Field label="Time format" value={timeFormat} onChangeText={setTimeFormat} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.success}>✓ Saved</Text> : null}

      <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color="#0b1522" /> : <Text style={styles.saveText}>Save changes</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  field: { flexGrow: 1, minWidth: 200, marginBottom: 16 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600", color: "#e8edf3", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#2c4463", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#0b1522",
  },
  textArea: { minHeight: 64, textAlignVertical: "top" },
  error: { color: "#ff9a93", fontSize: 13, marginTop: 4 },
  success: { color: "#6ee0ad", fontSize: 13, marginTop: 4, fontWeight: "600" },
  saveButton: { backgroundColor: "#ff9a4d", borderRadius: 8, minHeight: 44, justifyContent: "center", alignItems: "center", marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 24 },
  saveText: { color: "#1a0f05", fontWeight: "600", fontSize: 15 },
});
