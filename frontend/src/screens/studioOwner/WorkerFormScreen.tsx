import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workersApi } from "../../api/workersApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Worker } from "../../types/worker";
import { extractErrorMessage } from "../../api/errorMessage";
import { LookupTypeField } from "../../components/LookupTypeField";
import { emailError, mobileError, nameError } from "../../utils/customerValidation";
import { FormScreen, FormSection, FieldRow, Field, TextField } from "../../ui/Form";

interface Props {
  worker?: Worker;
  onDone: () => void;
  onCancel: () => void;
}

export function WorkerFormScreen({ worker, onDone, onCancel }: Props) {
  const isEdit = !!worker;
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(worker?.fullName ?? "");
  const [mobileNumber, setMobileNumber] = useState(worker?.mobileNumber ?? "");
  const [email, setEmail] = useState(worker?.email ?? "");
  const [workerTypeId, setWorkerTypeId] = useState<number | null>(worker?.workerTypeId ?? null);
  const [notes, setNotes] = useState(worker?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim() || undefined,
        email: email.trim() || undefined,
        workerTypeId: workerTypeId ?? undefined,
        notes: notes.trim() || undefined,
      };
      return isEdit ? workersApi.update(worker!.workerId, payload) : workersApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the worker. Please try again.")),
  });

  // Mobile is optional for a worker, so it's only checked once something is typed.
  const errors: Record<string, string | null> = {
    fullName: nameError(fullName),
    mobileNumber: mobileNumber.trim() ? mobileError(mobileNumber) : null,
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
      title={isEdit ? "Edit worker" : "New worker"}
      subtitle={isEdit ? worker!.fullName : "Photographers, videographers, editors — anyone you assign to shoots."}
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : "Create worker"}
      saving={mutation.isPending}
      error={error}
    >
      <FormSection title="Contact">
        <Field label="Full name" required error={show("fullName")}>
          <TextField invalid={!!show("fullName")} value={fullName} onChangeText={(v) => { setFullName(v); setError(null); }} onBlur={() => touch("fullName")} placeholder="Vikram Singh" />
        </Field>
        <FieldRow>
          <Field label="Mobile number" error={show("mobileNumber")} hint="Needed if you want to reach them on WhatsApp." flex>
            <TextField invalid={!!show("mobileNumber")} value={mobileNumber} onChangeText={(v) => { setMobileNumber(v); setError(null); }} onBlur={() => touch("mobileNumber")} placeholder="98765 43210" keyboardType="phone-pad" />
          </Field>
          <Field label="Email" error={show("email")} flex>
            <TextField invalid={!!show("email")} value={email} onChangeText={(v) => { setEmail(v); setError(null); }} onBlur={() => touch("email")} placeholder="vikram@example.com" autoCapitalize="none" keyboardType="email-address" />
          </Field>
        </FieldRow>
      </FormSection>

      <FormSection title="Role and notes">
        <LookupTypeField
          label="Worker type"
          noun="worker type"
          queryKey={["lookups", "workerTypes"]}
          api={lookupApis.workerTypes}
          selectedId={workerTypeId}
          onSelect={setWorkerTypeId}
        />
        <Field label="Notes">
          <TextField value={notes} onChangeText={setNotes} placeholder="Has own drone; available weekends" multiline numberOfLines={3} />
        </Field>
      </FormSection>
    </FormScreen>
  );
}
