import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseCategoriesApi } from "../../api/expenseCategoriesApi";
import type { ExpenseCategory } from "../../types/expenseCategory";
import { StatusPill } from "../../components/StatusPill";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

export function ExpenseCategoryListScreen({ onCreate, onEdit, onBack }: { onCreate: () => void; onEdit: (category: ExpenseCategory) => void; onBack: () => void }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["expense-categories"], queryFn: expenseCategoriesApi.getAll });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["expense-categories"] });

  const activate = useMutation({ mutationFn: expenseCategoriesApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: expenseCategoriesApi.deactivate, onSuccess: invalidate });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Expenses</Text>
      </Pressable>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Expense categories</Text>
          <Text style={styles.subtitle}>{data?.length ?? 0} total</Text>
        </View>
        <Pressable style={styles.newButton} onPress={onCreate}>
          <Text style={styles.newButtonText}>+ New Category</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 30 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load expense categories.</Text>
      ) : (
        <View style={styles.list}>
          {(data ?? []).map((item) => (
            <View key={item.expenseCategoryId} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.categoryName}</Text>
                {item.description ? <Text style={styles.rowDescription}>{item.description}</Text> : null}
                <StatusPill label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "good" : "neutral"} />
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} onPress={() => onEdit(item)}>
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => (item.isActive ? deactivate.mutate(item.expenseCategoryId) : activate.mutate(item.expenseCategoryId))}
                >
                  <Text style={styles.actionText}>{item.isActive ? "Deactivate" : "Activate"}</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {(data ?? []).length === 0 && <Text style={styles.empty}>No categories yet — add the first one.</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 560, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  newButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  newButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  list: { borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden" },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1b2c42", gap: 10,
  },
  rowMain: { flex: 1, gap: 4 },
  rowName: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  rowDescription: { color: "#a7b7cb", fontSize: 12 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  error: { color: "#ff7a72", marginTop: 30, textAlign: "center" },
  empty: { color: "#6f83a0", fontSize: 13, textAlign: "center", padding: 20 },
});
