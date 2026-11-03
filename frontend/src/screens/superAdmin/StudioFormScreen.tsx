import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studiosApi } from "../../api/studiosApi";
import { subscriptionPlansApi } from "../../api/subscriptionPlansApi";
import type { Studio } from "../../types/studio";
import { extractErrorMessage } from "../../api/errorMessage";
import { MiniDatePicker } from "../../components/MiniDatePicker";

// yyyy-mm-dd on this device's calendar.
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}
// Both dates count: 1 Oct to 30 Oct is 30 days.
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000) + 1;
}
function niceDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

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
  // New studios start on a free trial by default; the owner can pay for a plan later.
  const [access, setAccess] = useState<"trial" | "plan">("trial");
  const today = isoDay(new Date());
  const [trialFrom, setTrialFrom] = useState(today);
  const [trialTo, setTrialTo] = useState(addDays(today, 29));
  const trialDays = trialFrom && trialTo ? daysBetween(trialFrom, trialTo) : 0;
  const trialError = access !== "trial" ? null
    : !trialFrom || !trialTo ? "Choose both dates."
    : trialFrom < today ? "The trial can't start in the past."
    : trialDays < 1 ? "The end date must be on or after the start date."
    : trialDays > 366 ? "A free trial can be at most a year."
    : null;
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
            ...(access === "trial"
              ? { freeTrial: true, trialStartDate: trialFrom, trialEndDate: trialTo }
              : { subscriptionPlanId: subscriptionPlanId! }),
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
      <TextInput style={styles.input} value={studioName} onChangeText={setStudioName} placeholder="Aperture Weddings" placeholderTextColor="#8A8B92" />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Optional" placeholderTextColor="#8A8B92" />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Optional" placeholderTextColor="#8A8B92" />

      {!isEdit && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Studio owner account</Text>

          <Text style={styles.label}>Owner full name</Text>
          <TextInput style={styles.input} value={ownerFullName} onChangeText={setOwnerFullName} placeholder="Priya Shah" placeholderTextColor="#8A8B92" />

          <Text style={styles.label}>Owner email (login)</Text>
          <TextInput
            style={styles.input}
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="owner@studio.com"
            placeholderTextColor="#8A8B92"
          />

          <Text style={styles.label}>Temporary password</Text>
          <TextInput
            style={styles.input}
            value={ownerPassword}
            onChangeText={setOwnerPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor="#8A8B92"
          />

          <Text style={styles.label}>Access</Text>
          <View style={styles.planRow}>
            {([["trial", "Free trial", "Free to use between two dates"], ["plan", "Paid plan", "Start on a subscription plan"]] as const).map(([key, name, hint]) => (
              <Pressable key={key} style={[styles.planChip, access === key && styles.planChipSelected]} onPress={() => setAccess(key)}
                accessibilityRole="radio" accessibilityState={{ checked: access === key }}>
                <Text style={[styles.planChipName, access === key && styles.planChipNameSelected]}>{name}</Text>
                <Text style={[styles.planChipPrice, access === key && styles.planChipPriceSelected]}>{hint}</Text>
              </Pressable>
            ))}
          </View>

          {access === "trial" && (
            <View style={styles.trialBox}>
              <View style={styles.trialDates}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={styles.label}>From</Text>
                  <MiniDatePicker variant="form" value={trialFrom} onChange={(v) => {
                    // Moving the start keeps the same length of trial.
                    const len = trialDays > 0 ? trialDays : 30;
                    setTrialFrom(v);
                    setTrialTo(addDays(v, len - 1));
                  }} placeholder="Start date" />
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={styles.label}>To</Text>
                  <MiniDatePicker variant="form" value={trialTo} onChange={setTrialTo} placeholder="End date" />
                </View>
              </View>
              <View style={styles.quickRow}>
                {[30, 50, 60, 90].map((n) => (
                  <Pressable key={n} style={[styles.quickChip, trialDays === n && styles.quickChipOn]} onPress={() => setTrialTo(addDays(trialFrom || today, n - 1))}>
                    <Text style={[styles.quickText, trialDays === n && styles.quickTextOn]}>{n} days</Text>
                  </Pressable>
                ))}
              </View>
              {trialError ? (
                <Text style={styles.trialError}>{trialError}</Text>
              ) : (
                <Text style={styles.trialSummary}>
                  Free for <Text style={{ fontWeight: "800", color: "#292B31" }}>{trialDays} days</Text> — {niceDate(trialFrom)} to {niceDate(trialTo)} (both included).
                  {trialFrom > today ? " Until the start date the studio can sign in and look around, but not add or change anything." : ""}
                  {" "}After it ends the studio becomes read-only until they pay; nothing is deleted.
                </Text>
              )}
            </View>
          )}

          {access === "plan" && <Text style={styles.label}>Subscription plan</Text>}
          {access === "plan" && <View style={styles.planRow}>
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
          </View>}
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
          disabled={mutation.isPending || (!isEdit && (access === "plan" ? subscriptionPlanId === null : !!trialError))}
        >
          {mutation.isPending ? <ActivityIndicator color="#ECEBE6" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create studio"}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  trialBox: { borderWidth: 1, borderColor: "#D2D1CA", borderRadius: 10, padding: 14, marginTop: 10, backgroundColor: "rgba(229,228,223,0.5)" },
  trialDates: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  quickChip: { borderWidth: 1, borderColor: "#D2D1CA", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  quickChipOn: { borderColor: "#56566B", backgroundColor: "rgba(86,86,107,0.12)" },
  quickText: { color: "#55565E", fontSize: 12.5, fontWeight: "600" },
  quickTextOn: { color: "#56566B" },
  trialSummary: { color: "#55565E", fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  trialError: { color: "#A3473F", fontSize: 12.5, marginTop: 12 },
  screen: { flex: 1, backgroundColor: "#ECEBE6" },
  content: { padding: 24, maxWidth: 480, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#292B31", marginBottom: 20 },
  sectionLabel: { fontSize: 13, color: "#4F5D75", fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: "#D2D1CA", marginVertical: 18 },
  label: { fontSize: 13, color: "#55565E", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#D2D1CA", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#292B31", backgroundColor: "#E5E4DF",
  },
  error: { color: "#A3473F", marginTop: 16, fontSize: 13 },
  planRow: { flexDirection: "row", gap: 10 },
  planChip: {
    flex: 1, borderWidth: 1, borderColor: "#D2D1CA", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: "#E5E4DF",
  },
  planChipSelected: { borderColor: "#56566B", backgroundColor: "rgba(86,86,107,0.12)" },
  planChipName: { color: "#292B31", fontWeight: "700", fontSize: 14 },
  planChipNameSelected: { color: "#56566B" },
  planChipPrice: { color: "#8A8B92", fontSize: 12, marginTop: 2 },
  planChipPriceSelected: { color: "#454559" },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#D2D1CA", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#55565E", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#56566B", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#ECEBE6", fontWeight: "700" },
});
