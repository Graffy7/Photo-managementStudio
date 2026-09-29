import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { servicesApi } from "../../api/servicesApi";
import type { StudioService } from "../../types/service";
import { extractErrorMessage } from "../../api/errorMessage";
import { FormScreen, FormSection, Field, TextField } from "../../ui/Form";

interface Props {
  service?: StudioService;
  onDone: () => void;
  onCancel: () => void;
}

export function ServiceFormScreen({ service, onDone, onCancel }: Props) {
  const isEdit = !!service;
  const queryClient = useQueryClient();

  const [serviceName, setServiceName] = useState(service?.serviceName ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [defaultPrice, setDefaultPrice] = useState(service ? String(service.defaultPrice) : "");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        serviceName: serviceName.trim(),
        description: description.trim() || undefined,
        defaultPrice: Number(defaultPrice),
      };
      return isEdit ? servicesApi.update(service!.serviceId, payload) : servicesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the service. Please try again.")),
  });

  const nameError = tried && !serviceName.trim() ? "Enter the service name." : null;
  const priceError = tried && (!defaultPrice.trim() || Number.isNaN(Number(defaultPrice))) ? "Enter the usual price." : null;

  const submit = () => {
    setTried(true);
    if (!serviceName.trim() || !defaultPrice.trim() || Number.isNaN(Number(defaultPrice))) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <FormScreen
      title={isEdit ? "Edit service" : "New service"}
      subtitle="Services are the lines you add to quotations."
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : "Create service"}
      saving={mutation.isPending}
      error={error}
    >
      <FormSection title="Service">
        <Field label="Service name" required error={nameError}>
          <TextField invalid={!!nameError} value={serviceName} onChangeText={(v) => { setServiceName(v); setError(null); }} placeholder="Wedding Photography" />
        </Field>
        <Field label="Usual price" required error={priceError} hint="Filled in for you on a quotation; you can still change it there.">
          <TextField invalid={!!priceError} value={defaultPrice} onChangeText={(v) => { setDefaultPrice(v.replace(/[^0-9.]/g, "")); setError(null); }} placeholder="75000" keyboardType="numeric" />
        </Field>
        <Field label="Description">
          <TextField value={description} onChangeText={setDescription} placeholder="Full-day coverage, two photographers" multiline numberOfLines={3} />
        </Field>
      </FormSection>
    </FormScreen>
  );
}
