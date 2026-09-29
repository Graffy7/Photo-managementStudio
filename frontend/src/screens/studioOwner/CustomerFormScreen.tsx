import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "../../api/customersApi";
import type { Customer } from "../../types/customer";
import { extractErrorMessage } from "../../api/errorMessage";
import { CustomerEventsList } from "../../components/CustomerEventsList";
import { duplicateFrom, emailError, fieldErrorsFrom, mobileError, nameError, type DuplicateCustomer } from "../../utils/customerValidation";
import { FormScreen, FormSection, FieldRow, Field, TextField } from "../../ui/Form";
import { colors, radius, space, type } from "../../ui/theme";

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
  // Field errors show once a field has been left (or on pressing Save), not while typing the first time.
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

  // Pressing Save with problems marks every field so each shows what's wrong - never a silent no-op.
  const submit = () => {
    setTouched({ fullName: true, mobileNumber: true, email: true });
    if (!valid || mutation.isPending) {
      if (!valid) setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <FormScreen
      title={isEdit ? "Edit customer" : "New customer"}
      subtitle={isEdit ? customer!.fullName : "Only the name and mobile number are needed."}
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : "Create customer"}
      saving={mutation.isPending}
      error={error}
      above={isEdit ? (
        <View style={styles.events}>
          <Text style={styles.eventsTitle}>Booked events</Text>
          <CustomerEventsList customerId={customer!.customerId} />
        </View>
      ) : undefined}
    >
      <FormSection title="Contact">
        <Field label="Full name" required error={show("fullName")}>
          <TextField
            invalid={!!show("fullName")}
            value={fullName}
            onChangeText={(v) => { setFullName(v); setServerErrors((e) => ({ ...e, fullName: "" })); setError(null); }}
            onBlur={() => touch("fullName")}
            placeholder="Deepa Nair"
            accessibilityLabel="Full name (required)"
          />
        </Field>
        <FieldRow>
          <Field label="Mobile number" required error={show("mobileNumber")} hint="Used for WhatsApp and to find the customer later." flex>
            <TextField
              invalid={!!show("mobileNumber")}
              value={mobileNumber}
              onChangeText={(v) => { setMobileNumber(v); setDuplicate(null); setServerErrors((e) => ({ ...e, mobileNumber: "" })); setError(null); }}
              onBlur={() => touch("mobileNumber")}
              placeholder="90011 22334"
              keyboardType="phone-pad"
              accessibilityLabel="Mobile number (required)"
            />
          </Field>
          <Field label="Email" error={show("email")} flex>
            <TextField
              invalid={!!show("email")}
              value={email}
              onChangeText={(v) => { setEmail(v); setServerErrors((e) => ({ ...e, email: "" })); setError(null); }}
              onBlur={() => touch("email")}
              placeholder="deepa@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="More details">
        <Field label="Address">
          <TextField value={address} onChangeText={setAddress} placeholder="12 Lake View Road, Chennai" />
        </Field>
        <Field label="Notes" hint="Only your studio sees these.">
          <TextField value={notes} onChangeText={setNotes} placeholder="Prefers candid shots; call after 6pm" multiline numberOfLines={3} />
        </Field>
      </FormSection>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  events: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginTop: space.lg },
  eventsTitle: { ...type.heading, color: colors.text, marginBottom: space.md },
});
