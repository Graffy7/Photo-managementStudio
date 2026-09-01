import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { servicesApi } from "../../api/servicesApi";
import type { StudioService } from "../../types/service";
import { extractErrorMessage } from "../../api/errorMessage";

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
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave = serviceName.trim().length > 0 && defaultPrice.trim().length > 0 && !Number.isNaN(Number(defaultPrice));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit service" : "New service"}</Text>

      <Text style={styles.label}>Service name</Text>
      <TextInput style={styles.input} value={serviceName} onChangeText={setServiceName} placeholder="Wedding Photography" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        placeholderTextColor="#6f83a0"
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Default price</Text>
      <TextInput
        style={styles.input}
        value={defaultPrice}
        onChangeText={setDefaultPrice}
        placeholder="75000"
        placeholderTextColor="#6f83a0"
        keyboardType="numeric"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create service"}</Text>}
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
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
