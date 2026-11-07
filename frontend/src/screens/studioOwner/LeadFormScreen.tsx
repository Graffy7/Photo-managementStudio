import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "../../api/leadsApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Lead } from "../../types/lead";
import type { Lookup } from "../../types/lookup";
import { extractErrorMessage } from "../../api/errorMessage";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { emailError, mobileError, nameError } from "../../utils/customerValidation";
import { FormScreen, FormSection, FieldRow, Field, TextField } from "../../ui/Form";
import { colors, radius, space, type } from "../../ui/theme";
import { SelectField } from "../../ui/SelectField";

interface Props {
  lead?: Lead;
  onDone: () => void;
  onCancel: () => void;
}

export function LeadFormScreen({ lead, onDone, onCancel }: Props) {
  const isEdit = !!lead;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(lead?.fullName ?? "");
  const [mobileNumber, setMobileNumber] = useState(lead?.mobileNumber ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [eventTypeId, setEventTypeId] = useState<number | null>(lead?.eventTypeId ?? null);
  const [leadSourceId, setLeadSourceId] = useState<number | null>(lead?.leadSourceId ?? null);
  // Status is worked out automatically now (see LeadOutcome); an older manual status is kept as it was.
  const leadStatusId = lead?.leadStatusId ?? null;
  const [expectedEventDate, setExpectedEventDate] = useState(lead?.expectedEventDate?.slice(0, 10) ?? "");
  const [expectedBudget, setExpectedBudget] = useState(lead?.expectedBudget ? String(lead.expectedBudget) : "");
  const [location, setLocation] = useState(lead?.location ?? "");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [followUpDate, setFollowUpDate] = useState(lead?.followUpDate?.slice(0, 10) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { data: eventTypes } = useQuery({ queryKey: ["lookups", "eventTypes"], queryFn: lookupApis.eventTypes.getAll });
  const { data: leadSources } = useQuery({ queryKey: ["lookups", "leadSources"], queryFn: lookupApis.leadSources.getAll });

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
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the enquiry. Please try again.")),
  });

  const errors: Record<string, string | null> = {
    fullName: nameError(fullName),
    mobileNumber: mobileError(mobileNumber),
    email: emailError(email),
  };
  const valid = !errors.fullName && !errors.mobileNumber && !errors.email;
  const show = (field: string) => (touched[field] ? errors[field] : null);
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const submit = () => {
    setTouched({ fullName: true, mobileNumber: true, email: true });
    if (!valid) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <FormScreen
      title={isEdit ? "Edit enquiry" : "New enquiry"}
      subtitle={isEdit ? lead!.fullName : "Someone asked about a shoot? Note it here and follow up."}
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : "Create enquiry"}
      saving={mutation.isPending}
      error={error}
    >
      <FormSection title="Contact">
        <Field label="Full name" required error={show("fullName")}>
          <TextField invalid={!!show("fullName")} value={fullName} onChangeText={(v) => { setFullName(v); setError(null); }} onBlur={() => touch("fullName")} placeholder="Ananya Rao" />
        </Field>
        <FieldRow>
          <Field label="Mobile number" required error={show("mobileNumber")} flex>
            <TextField invalid={!!show("mobileNumber")} value={mobileNumber} onChangeText={(v) => { setMobileNumber(v); setError(null); }} onBlur={() => touch("mobileNumber")} placeholder="98765 43210" keyboardType="phone-pad" />
          </Field>
          <Field label="Email" error={show("email")} flex>
            <TextField invalid={!!show("email")} value={email} onChangeText={(v) => { setEmail(v); setError(null); }} onBlur={() => touch("email")} placeholder="ananya@example.com" autoCapitalize="none" keyboardType="email-address" />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="What they're looking for">
        <FieldRow>
          <Field label="Event type" flex>
            <SelectField<number | null>
              options={[{ value: null, label: "None" }, ...(eventTypes ?? []).map((t) => ({ value: t.id, label: t.name }))]}
              value={eventTypeId}
              onChange={setEventTypeId}
              placeholder="Choose event type"
              accessibilityLabel="Event type"
            />
          </Field>
          <Field label="Expected event date" flex>
            <MiniDatePicker variant="form" clearable value={expectedEventDate} onChange={setExpectedEventDate} placeholder="Select date" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Expected budget" flex>
            <TextField value={expectedBudget} onChangeText={(v) => setExpectedBudget(v.replace(/[^0-9.]/g, ""))} placeholder="75000" keyboardType="numeric" />
          </Field>
          <Field label="Location" flex>
            <TextField value={location} onChangeText={setLocation} placeholder="Coimbatore" />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="Follow-up">
        <FieldRow>
          <Field label="How they found you" flex>
            <SelectField<number | null>
              options={[{ value: null, label: "None" }, ...(leadSources ?? []).map((s) => ({ value: s.id, label: s.name }))]}
              value={leadSourceId}
              onChange={setLeadSourceId}
              placeholder="Choose a source"
              accessibilityLabel="How they found you"
            />
          </Field>
          <Field label="Follow-up date" hint="When to call them back." flex>
            <MiniDatePicker variant="form" clearable value={followUpDate} onChange={setFollowUpDate} placeholder="Select date" />
          </Field>
        </FieldRow>
        <Field label="Notes">
          <TextField value={notes} onChangeText={setNotes} placeholder="Wants a quote for wedding + reception" multiline numberOfLines={3} />
        </Field>
      </FormSection>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { minHeight: 40, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: space.lg, backgroundColor: colors.page },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.small, fontWeight: "600", color: colors.textMuted },
  chipTextOn: { color: colors.primary },
});
