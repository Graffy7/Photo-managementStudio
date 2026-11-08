import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseCategoriesApi } from "../../api/expenseCategoriesApi";
import type { ExpenseCategory } from "../../types/expenseCategory";
import { extractErrorMessage } from "../../api/errorMessage";
import { showSuccess } from "../../ui/SuccessPopup";

interface Props {
  category?: ExpenseCategory;
  onDone: () => void;
  onCancel: () => void;
}

export function ExpenseCategoryFormScreen({ category, onDone, onCancel }: Props) {
  const isEdit = !!category;
  const queryClient = useQueryClient();

  const [categoryName, setCategoryName] = useState(category?.categoryName ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { categoryName: categoryName.trim(), description: description.trim() || undefined };
      return isEdit ? expenseCategoriesApi.update(category!.expenseCategoryId, payload) : expenseCategoriesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      if (!isEdit) showSuccess("Category added", `${categoryName.trim()} is ready to use for expenses.`);
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave = categoryName.trim().length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit category" : "New category"}</Text>

      <Text style={styles.label}>Category name</Text>
      <TextInput style={styles.input} value={categoryName} onChangeText={setCategoryName} placeholder="Travel" placeholderTextColor="#A4AFCF" />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        placeholderTextColor="#A4AFCF"
        multiline
        numberOfLines={3}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? <ActivityIndicator color="#070F24" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Create category"}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070F24" },
  content: { padding: 16, paddingBottom: 32, maxWidth: 760, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#F2F5FF", marginBottom: 20 },
  label: { fontSize: 13, color: "#A4AFCF", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: "#2E4377", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#F2F5FF", backgroundColor: "#111E3F",
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  error: { color: "#FF5C75", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#2E4377", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#A4AFCF", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#5B9BFF", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#070F24", fontWeight: "700" },
});
