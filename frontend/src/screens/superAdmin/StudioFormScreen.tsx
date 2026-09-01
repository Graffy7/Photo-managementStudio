import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studiosApi } from "../../api/studiosApi";
import { subscriptionPlansApi } from "../../api/subscriptionPlansApi";
import type { Studio } from "../../types/studio";
import { extractErrorMessage } from "../../api/errorMessage";

interface Props {
  studio?: Studio;
  onDone: () => void;
  onCancel: () => void;
}

export function StudioFormScreen({ studio, onDone, onCancel }: Props) {
  const isEdit = !!studio;
  const queryClient = useQueryClient();

  const [studioName, setStudioName] = useState(studio?.studioName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(studio?.phoneNumber ?? "");
  const [address, setAddress] = useState(studio?.address ?? "");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: subscriptionPlansApi.getActive,
    enabled: !isEdit,
  });

  useEffect(() => {
    if (!isEdit && subscriptionPlanId === null && plans && plans.length > 0) {
      setSubscriptionPlanId(plans[0].subscriptionPlanId);
    }
  }, [plans, isEdit, subscriptionPlanId]);

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? studiosApi.update(studio!.studioId, { studioName, phoneNumber, address })
        : studiosApi.create({
            studioName,
            phoneNumber,
            address,
            ownerFullName,
            ownerEmail,
            ownerPassword,
            subscriptionPlanId: subscriptionPlanId!,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studios"] });
      onDone();
    },
    onError: (err) => {
      setError(extractErrorMessage(err));
    },
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit studio" : "New studio"}</Text>

      <Text style={styles.label}>Studio name</Text>
      <TextInput style={styles.input} value={studioName} onChangeText={setStudioName} placeholder="Aperture Weddings" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Optional" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Optional" placeholderTextColor="#6f83a0" />

      {!isEdit && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Studio owner account</Text>

          <Text style={styles.label}>Owner full name</Text>
          <TextInput style={styles.input} value={ownerFullName} onChangeText={setOwnerFullName} placeholder="Priya Shah" placeholderTextColor="#6f83a0" />

          <Text style={styles.label}>Owner email (login)</Text>
          <TextInput
            style={styles.input}
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="owner@studio.com"
            placeholderTextColor="#6f83a0"
          />

          <Text style={styles.label}>Temporary password</Text>
          <TextInput
            style={styles.input}
            value={ownerPassword}
            onChangeText={setOwnerPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor="#6f83a0"
          />

          <Text style={styles.label}>Subscription plan</Text>
          <View style={styles.planRow}>
            {(plans ?? []).map((plan) => {
              const selected = plan.subscriptionPlanId === subscriptionPlanId;
              return (
                <Pressable
                  key={plan.subscriptionPlanId}
                  style={[styles.planChip, selected && styles.planChipSelected]}
                  onPress={() => setSubscriptionPlanId(plan.subscriptionPlanId)}
                >
                  <Text style={[styles.planChipName, selected && styles.planChipNameSelected]}>{plan.planName}</Text>
                  <Text style={[styles.planChipPrice, selected && styles.planChipPriceSelected]}>
                    ₹{plan.price.toLocaleString("en-IN")} / {plan.durationInDays >= 300 ? "yr" : "mo"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={styles.saveButton}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending || (!isEdit && subscriptionPlanId === null)}
        >
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create studio"}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3", marginBottom: 20 },
  sectionLabel: { fontSize: 13, color: "#7fc0e6", fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: "#1b2c42", marginVertical: 18 },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#132540",
  },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  planRow: { flexDirection: "row", gap: 10 },
  planChip: {
    flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: "#132540",
  },
  planChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.12)" },
  planChipName: { color: "#e8edf3", fontWeight: "700", fontSize: 14 },
  planChipNameSelected: { color: "#ff9a4d" },
  planChipPrice: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  planChipPriceSelected: { color: "#ffb877" },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
