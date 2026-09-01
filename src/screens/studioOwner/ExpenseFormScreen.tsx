import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "../../api/expensesApi";
import { expenseCategoriesApi } from "../../api/expenseCategoriesApi";
import type { Expense } from "../../types/expense";
import { extractErrorMessage } from "../../api/errorMessage";

interface Props {
  expense?: Expense;
  onDone: () => void;
  onCancel: () => void;
}

export function ExpenseFormScreen({ expense, onDone, onCancel }: Props) {
  const isEdit = !!expense;
  const queryClient = useQueryClient();

  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(expense?.expenseCategoryId ?? null);
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate?.slice(0, 10) ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? "");
  const [referenceNumber, setReferenceNumber] = useState(expense?.referenceNumber ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: categories } = useQuery({ queryKey: ["expense-categories"], queryFn: expenseCategoriesApi.getAll });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        expenseCategoryId: expenseCategoryId!,
        expenseDate: expenseDate.trim(),
        amount: Number(amount),
        description: description.trim() || undefined,
        paymentMethod: paymentMethod.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
      };
      return isEdit ? expensesApi.update(expense!.expenseId, payload) : expensesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const canSave = expenseCategoryId !== null && Number(amount) > 0 && expenseDate.trim().length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isEdit ? "Edit expense" : "New expense"}</Text>

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {(categories ?? []).map((c) => (
          <Pressable key={c.expenseCategoryId} style={[styles.chip, expenseCategoryId === c.expenseCategoryId && styles.chipSelected]} onPress={() => setExpenseCategoryId(c.expenseCategoryId)}>
            <Text style={[styles.chipText, expenseCategoryId === c.expenseCategoryId && styles.chipTextSelected]}>{c.categoryName}</Text>
          </Pressable>
        ))}
        {categories?.length === 0 && <Text style={styles.hint}>No categories yet — add one from the Expenses screen first.</Text>}
      </View>

      <Text style={styles.label}>Amount</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="2500" placeholderTextColor="#6f83a0" keyboardType="numeric" />

      <Text style={styles.label}>Expense date</Text>
      <TextInput style={styles.input} value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Optional" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Payment method</Text>
      <TextInput style={styles.input} value={paymentMethod} onChangeText={setPaymentMethod} placeholder="Cash, UPI, Card... (optional)" placeholderTextColor="#6f83a0" />

      <Text style={styles.label}>Reference number</Text>
      <TextInput style={styles.input} value={referenceNumber} onChangeText={setReferenceNumber} placeholder="Optional" placeholderTextColor="#6f83a0" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={() => mutation.mutate()} disabled={mutation.isPending || !canSave}>
          {mutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.saveText}>{isEdit ? "Save changes" : "Record expense"}</Text>}
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  chipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#ff9a4d" },
  hint: { color: "#6f83a0", fontSize: 12 },
  error: { color: "#ff7a72", marginTop: 16, fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: "#a7b7cb", fontWeight: "600" },
  saveButton: { flex: 2, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#0d1826", fontWeight: "700" },
});
