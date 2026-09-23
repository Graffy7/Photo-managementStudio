import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6f83a0"
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

export function StudioProfileTab() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["studio-profile"], queryFn: settingsApi.getProfile });

  const [studioName, setStudioName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setStudioName(data.studioName);
    setOwnerName(data.ownerName ?? "");
    setPhoneNumber(data.phoneNumber ?? "");
    setEmail(data.email);
    setAddress(data.address ?? "");
    setCity(data.city ?? "");
    setState(data.state ?? "");
    setPincode(data.pincode ?? "");
    setGstNumber(data.gstNumber ?? "");
    setWebsite(data.website ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updateProfile({
        studioName: studioName.trim(),
        ownerName: ownerName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
        website: website.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio-profile"] });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave = studioName.trim().length > 0;

  if (isPending) {
    return <ActivityIndicator color="#7fc0e6" style={{ marginTop: 40 }} />;
  }

  return (
    <View>
      <View style={styles.row}>
        <Field label="Studio / Company Name" value={studioName} onChangeText={setStudioName} />
        <Field label="Owner Name" value={ownerName} onChangeText={setOwnerName} />
      </View>
      <View style={styles.row}>
        <Field label="Mobile Number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      </View>

      <Field label="Address" value={address} onChangeText={setAddress} />

      <View style={styles.row}>
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="State" value={state} onChangeText={setState} />
        <Field label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="phone-pad" />
      </View>

      <View style={styles.row}>
        <Field label="GST Number (optional)" value={gstNumber} onChangeText={setGstNumber} placeholder="e.g. 33ABCDE1234F1Z5" />
        <Field label="Website (optional)" value={website} onChangeText={setWebsite} placeholder="https://example.com" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.success}>✓ Saved</Text> : null}

      <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
        {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>Save changes</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  field: { flexGrow: 1, minWidth: 200, marginBottom: 14 },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: "#e8edf3", backgroundColor: "#132540",
  },
  error: { color: "#ff7a72", fontSize: 13, marginTop: 4 },
  success: { color: "#4cc493", fontSize: 13, marginTop: 4, fontWeight: "600" },
  saveButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 28 },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
