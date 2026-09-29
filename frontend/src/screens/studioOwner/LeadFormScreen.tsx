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

interface Props {
  lead?: Lead;
  onDone: () => void;
  onCancel: () => void;
}

// One choice from a studio's own list (event types, sources, statuses), or none.
function LookupChips({ options, selectedId, onSelect }: { options: Lookup[]; selectedId: number | null; onSelect: (id: number | null) => void }) {
  const all: { id: number | null; name: string }[] = [{ id: null, name: "None" }, ...options];
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {all.map((o) => {
        const on = selectedId === o.id;
        return (
          <Pressable key={String(o.id)} style={[styles.chip, on && styles.chipOn]} onPress={() => onSelect(o.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.name}</Text>
          </Pressable>
        );
      })}
    </View>
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
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
        {(eventTypes ?? []).length > 0 && (
          <Field label="Event type">
            <LookupChips options={eventTypes ?? []} selectedId={eventTypeId} onSelect={setEventTypeId} />
          </Field>
        )}
        <FieldRow>
          <Field label="Expected event date" flex>
            <MiniDatePicker variant="form" clearable value={expectedEventDate} onChange={setExpectedEventDate} placeholder="Select date" />
          </Field>
          <Field label="Expected budget" flex>
            <TextField value={expectedBudget} onChangeText={(v) => setExpectedBudget(v.replace(/[^0-9.]/g, ""))} placeholder="75000" keyboardType="numeric" />
          </Field>
        </FieldRow>
        <Field label="Location">
          <TextField value={location} onChangeText={setLocation} placeholder="Coimbatore" />
        </Field>
      </FormSection>

      <FormSection title="Follow-up">
        {(leadStatuses ?? []).length > 0 && (
          <Field label="Status">
            <LookupChips options={leadStatuses ?? []} selectedId={leadStatusId} onSelect={setLeadStatusId} />
          </Field>
        )}
        {(leadSources ?? []).length > 0 && (
          <Field label="How they found you">
            <LookupChips options={leadSources ?? []} selectedId={leadSourceId} onSelect={setLeadSourceId} />
          </Field>
        )}
        <Field label="Follow-up date" hint="When to call them back.">
          <MiniDatePicker variant="form" clearable value={followUpDate} onChange={setFollowUpDate} placeholder="Select date" />
        </Field>
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
