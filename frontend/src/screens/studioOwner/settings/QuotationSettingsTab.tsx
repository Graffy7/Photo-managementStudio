import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { Toggle } from "../../../components/Toggle";

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Toggle value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function QuotationSettingsTab() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["quotation-settings"], queryFn: settingsApi.getQuotationSettings });

  const [prefix, setPrefix] = useState("Q-");
  const [startingNumber, setStartingNumber] = useState("1");
  const [defaultTerms, setDefaultTerms] = useState("");
  const [defaultNotes, setDefaultNotes] = useState("");
  const [showGst, setShowGst] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setPrefix(data.prefix);
    setStartingNumber(String(data.startingNumber));
    setDefaultTerms(data.defaultTerms);
    setDefaultNotes(data.defaultNotes);
    setShowGst(data.showGst);
    setShowAddress(data.showAddress);
    setShowContact(data.showContact);
    setShowLogo(data.showLogo);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updateQuotationSettings({
        prefix: prefix.trim() || "Q-",
        startingNumber: Number(startingNumber) || 1,
        defaultTerms: defaultTerms.trim(),
        defaultNotes: defaultNotes.trim(),
        showGst,
        showAddress,
        showContact,
        showLogo,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation-settings"] });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  if (isPending) {
    return <ActivityIndicator color="#5B9BFF" style={{ marginTop: 40 }} />;
  }

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Quotation prefix</Text>
          <TextInput style={styles.input} value={prefix} onChangeText={setPrefix} placeholderTextColor="#A4AFCF" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Starting quotation number</Text>
          <TextInput style={styles.input} value={startingNumber} onChangeText={setStartingNumber} keyboardType="numeric" placeholderTextColor="#A4AFCF" />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Default quotation terms</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={defaultTerms}
          onChangeText={setDefaultTerms}
          multiline
          numberOfLines={3}
          placeholderTextColor="#A4AFCF"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Default notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={defaultNotes}
          onChangeText={setDefaultNotes}
          multiline
          numberOfLines={3}
          placeholderTextColor="#A4AFCF"
        />
      </View>

      <Text style={[styles.label, { marginTop: 6 }]}>What shows on the quotation PDF</Text>
      <View style={styles.toggleList}>
        <ToggleRow label="Show GST number" value={showGst} onValueChange={setShowGst} />
        <ToggleRow label="Show studio address" value={showAddress} onValueChange={setShowAddress} />
        <ToggleRow label="Show studio contact details" value={showContact} onValueChange={setShowContact} />
        <ToggleRow label="Show logo" value={showLogo} onValueChange={setShowLogo} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.success}>✓ Saved</Text> : null}

      <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color="#070F24" /> : <Text style={styles.saveText}>Save changes</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  field: { flexGrow: 1, minWidth: 200, marginBottom: 16 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600", color: "#F2F5FF", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#2E4377", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44,
    fontSize: 15, color: "#F2F5FF", backgroundColor: "#070F24",
  },
  textArea: { minHeight: 64, textAlignVertical: "top" },
  toggleList: {
    borderWidth: 1, borderColor: "#2E4377", borderRadius: 10, backgroundColor: "#111E3F", overflow: "hidden", marginBottom: 14,
  },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1E2D57",
  },
  toggleLabel: { color: "#F2F5FF", fontSize: 14, fontWeight: "600" },
  error: { color: "#FF5C75", fontSize: 13, marginTop: 4 },
  success: { color: "#22C58B", fontSize: 13, marginTop: 4, fontWeight: "600" },
  saveButton: { backgroundColor: "#5B9BFF", borderRadius: 8, minHeight: 44, justifyContent: "center", alignItems: "center", marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 24 },
  saveText: { color: "#070F24", fontWeight: "600", fontSize: 15 },
});
