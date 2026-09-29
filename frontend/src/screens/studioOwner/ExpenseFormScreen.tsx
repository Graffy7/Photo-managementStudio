import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "../../api/expensesApi";
import { expenseCategoriesApi } from "../../api/expenseCategoriesApi";
import type { Expense } from "../../types/expense";
import { extractErrorMessage } from "../../api/errorMessage";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { FormScreen, FormSection, FieldRow, Field, TextField } from "../../ui/Form";
import { colors, radius, space, type } from "../../ui/theme";

interface Props {
  expense?: Expense;
  onDone: () => void;
  onCancel: () => void;
}

// Today on this device (not UTC).
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExpenseFormScreen({ expense, onDone, onCancel }: Props) {
  const isEdit = !!expense;
  const queryClient = useQueryClient();

  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(expense?.expenseCategoryId ?? null);
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate?.slice(0, 10) ?? localToday());
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? "");
  const [referenceNumber, setReferenceNumber] = useState(expense?.referenceNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

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
    onError: (err) => setError(extractErrorMessage(err, "Couldn't save the expense. Please try again.")),
  });

  const categoryError = tried && expenseCategoryId === null ? "Choose a category." : null;
  const amountError = tried && !(Number(amount) > 0) ? "Enter the amount." : null;
  const dateError = tried && !expenseDate.trim() ? "Choose the date." : null;

  const submit = () => {
    setTried(true);
    if (expenseCategoryId === null || !(Number(amount) > 0) || !expenseDate.trim()) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <FormScreen
      title={isEdit ? "Edit expense" : "Record an expense"}
      onCancel={onCancel}
      onSave={submit}
      saveLabel={isEdit ? "Save changes" : "Record expense"}
      saving={mutation.isPending}
      error={error}
    >
      <FormSection title="Expense">
        <Field label="Category" required error={categoryError}>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {(categories ?? []).map((c) => {
              const on = expenseCategoryId === c.expenseCategoryId;
              return (
                <Pressable key={c.expenseCategoryId} style={[styles.chip, on && styles.chipOn]} onPress={() => { setExpenseCategoryId(c.expenseCategoryId); setError(null); }} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.categoryName}</Text>
                </Pressable>
              );
            })}
            {categories?.length === 0 && <Text style={styles.hint}>No categories yet. Add one from the Expenses page first.</Text>}
          </View>
        </Field>
        <FieldRow>
          <Field label="Amount" required error={amountError} flex>
            <TextField invalid={!!amountError} value={amount} onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, "")); setError(null); }} placeholder="2500" keyboardType="numeric" />
          </Field>
          <Field label="Date" required error={dateError} flex>
            <MiniDatePicker variant="form" value={expenseDate} onChange={setExpenseDate} placeholder="Select date" />
          </Field>
        </FieldRow>
        <Field label="Description">
          <TextField value={description} onChangeText={setDescription} placeholder="Fuel for the Ooty shoot" />
        </Field>
        <FieldRow>
          <Field label="Paid by" flex>
            <TextField value={paymentMethod} onChangeText={setPaymentMethod} placeholder="Cash, UPI, Card" />
          </Field>
          <Field label="Reference number" flex>
            <TextField value={referenceNumber} onChangeText={setReferenceNumber} placeholder="Bill no. 4412" />
          </Field>
        </FieldRow>
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
  hint: { ...type.small, color: colors.textMuted },
});
