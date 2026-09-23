import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formConfigApi } from "../../api/formConfigApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { Toggle } from "../../components/Toggle";
import { FIELD_TYPES, type FormField } from "../../types/formField";

const FORM_CODE = "LEAD_FORM";

function FieldRow({ field, onSave, saving }: { field: FormField; onSave: (draft: FormField) => void; saving: boolean }) {
  const [label, setLabel] = useState(field.label);
  const [isRequired, setIsRequired] = useState(field.isRequired);
  const [isVisible, setIsVisible] = useState(field.isVisible);
  const [isEnabled, setIsEnabled] = useState(field.isEnabled);

  const dirty = label !== field.label || isRequired !== field.isRequired || isVisible !== field.isVisible || isEnabled !== field.isEnabled;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.fieldKey}>{field.fieldKey}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{field.fieldType}</Text>
        </View>
      </View>

      <TextInput style={styles.labelInput} value={label} onChangeText={setLabel} placeholder="Field label" placeholderTextColor="#6f83a0" />

      {field.options.length > 0 && (
        <Text style={styles.optionsPreview}>Options: {field.options.map((o) => o.optionLabel).join(", ")}</Text>
      )}

      <View style={styles.switchRow}>
        <View style={styles.switchItem}>
          <Text style={styles.switchLabel}>Required</Text>
          <Toggle value={isRequired} onValueChange={setIsRequired} />
        </View>
        <View style={styles.switchItem}>
          <Text style={styles.switchLabel}>Visible</Text>
          <Toggle value={isVisible} onValueChange={setIsVisible} />
        </View>
        <View style={styles.switchItem}>
          <Text style={styles.switchLabel}>Enabled</Text>
          <Toggle value={isEnabled} onValueChange={setIsEnabled} />
        </View>
      </View>

      {dirty && (
        <Pressable
          style={styles.saveButton}
          onPress={() => onSave({ ...field, label, isRequired, isVisible, isEnabled })}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#0d1826" size="small" /> : <Text style={styles.saveButtonText}>Save</Text>}
        </Pressable>
      )}
    </View>
  );
}

export function LeadFormConfigScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { data: fields, isPending } = useQuery({ queryKey: ["form-fields", FORM_CODE], queryFn: () => formConfigApi.getFields(FORM_CODE) });

  const [showAddField, setShowAddField] = useState(false);
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<string>("TEXT");
  const [optionsText, setOptionsText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["form-fields", FORM_CODE] });

  const updateField = useMutation({
    mutationFn: (field: FormField) =>
      formConfigApi.updateField(FORM_CODE, field.formFieldId, {
        label: field.label,
        isRequired: field.isRequired,
        isVisible: field.isVisible,
        isEnabled: field.isEnabled,
        displayOrder: field.displayOrder,
      }),
    onSuccess: invalidate,
  });

  const addField = useMutation({
    mutationFn: () =>
      formConfigApi.addCustomField(FORM_CODE, {
        fieldKey,
        label,
        fieldType,
        isRequired: false,
        displayOrder: (fields?.length ?? 0) + 1,
        options: ["DROPDOWN", "MULTISELECT"].includes(fieldType) && optionsText.trim()
          ? optionsText.split(",").map((o) => o.trim()).filter(Boolean)
          : undefined,
      }),
    onSuccess: () => {
      setFieldKey("");
      setLabel("");
      setOptionsText("");
      setFieldType("TEXT");
      setShowAddField(false);
      setAddError(null);
      invalidate();
    },
    onError: (err) => setAddError(extractErrorMessage(err)),
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>‹ Settings</Text>
      </Pressable>
      <Text style={styles.title}>Enquiry form fields</Text>
      <Text style={styles.subtitle}>Control what shows on the enquiry form — hide fields, make them required, or add your own.</Text>

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 30 }} />
      ) : (
        (fields ?? [])
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((field) => (
            <FieldRow key={field.formFieldId} field={field} onSave={(draft) => updateField.mutate(draft)} saving={updateField.isPending} />
          ))
      )}

      {showAddField ? (
        <View style={styles.card}>
          <Text style={styles.addTitle}>New custom field</Text>

          <Text style={styles.smallLabel}>Field key (no spaces)</Text>
          <TextInput style={styles.labelInput} value={fieldKey} onChangeText={setFieldKey} placeholder="InstagramId" placeholderTextColor="#6f83a0" autoCapitalize="none" />

          <Text style={styles.smallLabel}>Label</Text>
          <TextInput style={styles.labelInput} value={label} onChangeText={setLabel} placeholder="Instagram ID" placeholderTextColor="#6f83a0" />

          <Text style={styles.smallLabel}>Field type</Text>
          <View style={styles.typeChipRow}>
            {FIELD_TYPES.map((t) => (
              <Pressable key={t} style={[styles.typeChip, fieldType === t && styles.typeChipSelected]} onPress={() => setFieldType(t)}>
                <Text style={[styles.typeChipText, fieldType === t && styles.typeChipTextSelected]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {["DROPDOWN", "MULTISELECT"].includes(fieldType) && (
            <>
              <Text style={styles.smallLabel}>Options (comma-separated)</Text>
              <TextInput
                style={styles.labelInput}
                value={optionsText}
                onChangeText={setOptionsText}
                placeholder="Friend, Instagram Ad, Google Search"
                placeholderTextColor="#6f83a0"
              />
            </>
          )}

          {addError ? <Text style={styles.error}>{addError}</Text> : null}

          <View style={styles.addFieldButtonRow}>
            <Pressable style={styles.cancelButton} onPress={() => setShowAddField(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.saveButton}
              onPress={() => fieldKey.trim() && label.trim() && addField.mutate()}
              disabled={addField.isPending}
            >
              {addField.isPending ? <ActivityIndicator color="#0d1826" size="small" /> : <Text style={styles.saveButtonText}>Add field</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addFieldTrigger} onPress={() => setShowAddField(true)}>
          <Text style={styles.addFieldTriggerText}>+ Add custom field</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 560, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 4, marginBottom: 20 },
  card: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540",
    padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  fieldKey: { color: "#6f83a0", fontSize: 11, fontFamily: "monospace" },
  typeBadge: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8 },
  typeBadgeText: { color: "#7fc0e6", fontSize: 10, fontWeight: "700" },
  labelInput: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: "#e8edf3", backgroundColor: "#0d1826", marginBottom: 8,
  },
  optionsPreview: { color: "#6f83a0", fontSize: 12, marginBottom: 8 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  switchItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  switchLabel: { color: "#a7b7cb", fontSize: 12 },
  saveButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 9, alignItems: "center", marginTop: 12 },
  saveButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  addFieldTrigger: { borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  addFieldTriggerText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  addTitle: { color: "#e8edf3", fontWeight: "700", fontSize: 15, marginBottom: 12 },
  smallLabel: { color: "#a7b7cb", fontSize: 12, marginBottom: 6, marginTop: 4 },
  typeChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  typeChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 5, paddingHorizontal: 10 },
  typeChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.12)" },
  typeChipText: { color: "#a7b7cb", fontSize: 10, fontWeight: "600" },
  typeChipTextSelected: { color: "#ff9a4d" },
  error: { color: "#ff7a72", fontSize: 12, marginTop: 4 },
  addFieldButtonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  cancelButtonText: { color: "#a7b7cb", fontWeight: "600", fontSize: 13 },
});
