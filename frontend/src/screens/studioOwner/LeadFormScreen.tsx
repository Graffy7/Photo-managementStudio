import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "../../api/leadsApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Lead } from "../../types/lead";
import type { Lookup } from "../../types/lookup";
import { extractErrorMessage } from "../../api/errorMessage";

interface Props {
  lead?: Lead;
  onDone: () => void;
  onCancel: () => void;
}

function LookupChips({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: Lookup[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        <Pressable style={[styles.chip, selectedId === null && styles.chipSelected]} onPress={() => onSelect(null)}>
          <Text style={[styles.chipText, selectedId === null && styles.chipTextSelected]}>None</Text>
        </Pressable>
        {options.map((o) => (
          <Pressable key={o.id} style={[styles.chip, selectedId === o.id && styles.chipSelected]} onPress={() => onSelect(o.id)}>
            <Text style={[styles.chipText, selectedId === o.id && styles.chipTextSelected]}>{o.name}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export function LeadFormScreen({ lead, onDone, onCancel }: Props) {
  const isEdit = !!lead;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(lead?.fullName ?? "");
  const [mobileNumber, setMobileNumber] = useState(lead?.mobileNumber ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [eventTypeId, setEventTypeId] = useState<number | null>(lead?.eventTypeId ?? null);
  const [leadSourceId, setLeadSourceId] = useState<number | null>(lead?.leadSourceId ?? null);
  const [leadStatusId, setLeadStatusId] = useState<number | null>(lead?.leadStatusId ?? null);
  const [expectedEventDate, setExpectedEventDate] = useState(lead?.expectedEventDate?.slice(0, 10) ?? "");
  const [expectedBudget, setExpectedBudget] = useState(lead?.expectedBudget ? String(lead.expectedBudget) : "");
  const [location, setLocation] = useState(lead?.location ?? "");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [followUpDate, setFollowUpDate] = useState(lead?.followUpDate?.slice(0, 10) ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: eventTypes } = useQuery({ queryKey: ["lookups", "eventTypes"], queryFn: lookupApis.eventTypes.getAll });
  const { data: leadSources } = useQuery({ queryKey: ["lookups", "leadSources"], queryFn: lookupApis.leadSources.getAll });
  const { data: leadStatuses } = useQuery({ queryKey: ["lookups", "leadStatuses"], queryFn: lookupApis.leadStatuses.getAll });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim() || undefined,
        eventTypeId: eventTypeId ?? undefined,
        leadSourceId: leadSourceId ?? undefined,
        leadStatusId: leadStatusId ?? undefined,
        expectedEventDate: expectedEventDate.trim() || undefined,
        expectedBudget: expectedBudget.trim() ? Number(expectedBudget) : undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        followUpDate: followUpDate.trim() || undefined,
      };
      return isEdit ? leadsApi.update(lead!.leadId, payload) : leadsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave = fullName.trim().length > 0 && mobileNumber.trim().length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit enquiry" : "New enquiry"}</Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Ananya Rao" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Mobile number</Text>
      <TextInput
        style={styles.input}
        value={mobileNumber}
        onChangeText={setMobileNumber}
        placeholder="9876543210"
        placeholderTextColor="#6f83a0"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Optional"
        placeholderTextColor="#6f83a0"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <LookupChips label="Event type" options={eventTypes ?? []} selectedId={eventTypeId} onSelect={setEventTypeId} />
      <LookupChips label="Enquiry source" options={leadSources ?? []} selectedId={leadSourceId} onSelect={setLeadSourceId} />
      <LookupChips label="Enquiry status" options={leadStatuses ?? []} selectedId={leadStatusId} onSelect={setLeadStatusId} />

      <Text style={styles.label}>Expected event date</Text>
      <TextInput
        style={styles.input}
        value={expectedEventDate}
        onChangeText={setExpectedEventDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#6f83a0"
      />

      <Text style={styles.label}>Expected budget</Text>
      <TextInput
        style={styles.input}
        value={expectedBudget}
        onChangeText={setExpectedBudget}
        placeholder="Optional"
        placeholderTextColor="#6f83a0"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Location</Text>
      <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Optional" placeholderTextColor="#6f83a0" />

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

      <Text style={styles.label}>Follow-up date</Text>
      <TextInput
        style={styles.input}
        value={followUpDate}
        onChangeText={setFollowUpDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#6f83a0"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create enquiry"}</Text>}
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
