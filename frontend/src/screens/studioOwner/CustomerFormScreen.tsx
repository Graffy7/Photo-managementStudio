import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "../../api/customersApi";
import type { Customer } from "../../types/customer";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerEventsList } from "../../components/CustomerEventsList";
import { duplicateFrom, emailError, fieldErrorsFrom, mobileError, nameError, type DuplicateCustomer } from "../../utils/customerValidation";

// Dim enough that an example never looks like a filled-in value.
const PLACEHOLDER = "#4f6280";

interface Props {
  customer?: Customer;
  onDone: () => void;
  onCancel: () => void;
}

export function CustomerFormScreen({ customer, onDone, onCancel }: Props) {
  const isEdit = !!customer;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(customer?.fullName ?? "");
  const [mobileNumber, setMobileNumber] = useState(customer?.mobileNumber ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  // Field errors show once a field has been left (or on pressing Create), not while typing the first time.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<DuplicateCustomer | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      return isEdit ? customersApi.update(customer!.customerId, payload) : customersApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onDone();
    },
    onError: (err) => {
      const dup = duplicateFrom(err);
      const fields = fieldErrorsFrom(err);
      setDuplicate(dup);
      setServerErrors(fields);
      setError(dup || Object.keys(fields).length ? null : extractErrorMessage(err, "Couldn't save the customer. Please try again."));
    },
  });

  const errors: Record<string, string | null> = {
    fullName: nameError(fullName) ?? serverErrors.fullName ?? null,
    mobileNumber: mobileError(mobileNumber) ?? (duplicate ? duplicate.message : serverErrors.mobileNumber ?? null),
    email: emailError(email) ?? serverErrors.email ?? null,
  };
  const valid = !errors.fullName && !mobileError(mobileNumber) && !errors.email;
  const show = (field: string) => (touched[field] ? errors[field] : null);
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  // Pressing Create with problems marks every field so each shows what's wrong - never a silent no-op.
  const submit = () => {
    setTouched({ fullName: true, mobileNumber: true, email: true });
    if (!valid || mutation.isPending) return;
    setError(null);
    mutation.mutate();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit customer" : "New customer"}</Text>

      {isEdit && (
        <View style={styles.eventsCard}>
          <Text style={styles.eventsCardLabel}>Booked Events</Text>
          <CustomerEventsList customerId={customer!.customerId} />
        </View>
      )}

      <Text style={styles.label}>Full name <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.input, show("fullName") && styles.inputError]}
        value={fullName}
        onChangeText={(v) => { setFullName(v); setServerErrors((e) => ({ ...e, fullName: "" })); }}
        onBlur={() => touch("fullName")}
        placeholder="e.g. Deepa Nair"
        placeholderTextColor={PLACEHOLDER}
        accessibilityLabel="Full name (required)"
      />
      {show("fullName") ? <Text style={styles.fieldError}>{show("fullName")}</Text> : null}

      <Text style={styles.label}>Mobile number <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={[styles.input, show("mobileNumber") && styles.inputError]}
        value={mobileNumber}
        onChangeText={(v) => { setMobileNumber(v); setDuplicate(null); setServerErrors((e) => ({ ...e, mobileNumber: "" })); }}
        onBlur={() => touch("mobileNumber")}
        placeholder="e.g. 90011 22334"
        placeholderTextColor={PLACEHOLDER}
        keyboardType="phone-pad"
        accessibilityLabel="Mobile number (required)"
      />
      {show("mobileNumber") ? <Text style={styles.fieldError}>{show("mobileNumber")}</Text> : null}

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={[styles.input, show("email") && styles.inputError]}
        value={email}
        onChangeText={(v) => { setEmail(v); setServerErrors((e) => ({ ...e, email: "" })); }}
        onBlur={() => touch("email")}
        placeholder="Optional"
        placeholderTextColor={PLACEHOLDER}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {show("email") ? <Text style={styles.fieldError}>{show("email")}</Text> : null}

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Optional" placeholderTextColor={PLACEHOLDER} />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        placeholderTextColor={PLACEHOLDER}
        multiline
        numberOfLines={3}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, (!valid || mutation.isPending) && styles.saveButtonDisabled]}
          onPress={submit}
          disabled={mutation.isPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: !valid || mutation.isPending, busy: mutation.isPending }}
        >
          {mutation.isPending ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color="#0d1826" size="small" />
              <Text style={styles.saveText}>Saving…</Text>
            </View>
          ) : (
            <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create customer"}</Text>
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
  eventsCard: {
    backgroundColor: "#132540", borderRadius: 12, borderWidth: 1, borderColor: "#23405c", padding: 18, marginBottom: 20,
  },
  eventsCardLabel: {
    fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  label: { fontSize: 13, color: "#a7b7cb", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#e8edf3", backgroundColor: "#132540",
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  required: { color: "#ff9a4d" },
  inputError: { borderColor: "#ff7a72" },
  fieldError: { color: "#ff7a72", fontSize: 12, marginTop: 5 },
  saveButtonDisabled: { opacity: 0.55 },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
