import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expenseCategoriesApi } from "../../api/expenseCategoriesApi";
import type { ExpenseCategory } from "../../types/expenseCategory";
import { StatusPill } from "../../components/StatusPill";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

export function ExpenseCategoryListScreen({ onCreate, onEdit, onBack }: { onCreate: () => void; onEdit: (category: ExpenseCategory) => void; onBack: () => void }) {
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["expense-categories"], queryFn: expenseCategoriesApi.getAll });
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
        <SubscriptionLock>
          <Pressable style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>+ New Category</Text>
          </Pressable>
        </SubscriptionLock>
      </View>

      {isPending ? (
        <ActivityIndicator color="#56566B" style={{ marginTop: 30 }} />
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
                <SubscriptionLock compact>
                  <Pressable style={styles.actionBtn} onPress={() => onEdit(item)}>
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                </SubscriptionLock>
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
  screen: { flex: 1, backgroundColor: "#F1F0EC" },
  content: { padding: 16, paddingBottom: 32, maxWidth: 760, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 14 },
  backText: { color: "#4F5D75", fontSize: 13, fontWeight: "600" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700", color: "#292B31" },
  subtitle: { fontSize: 13, color: "#6F7078", marginTop: 2 },
  newButton: { backgroundColor: "#56566B", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  newButtonText: { color: "#F1F0EC", fontWeight: "700", fontSize: 13 },
  list: { borderWidth: 1, borderColor: "#C4C3BB", borderRadius: 10, backgroundColor: "#ECEBE6", overflow: "hidden" },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#D2D1CA", gap: 10,
  },
  rowMain: { flex: 1, gap: 4 },
  rowName: { color: "#292B31", fontSize: 15, fontWeight: "600" },
  rowDescription: { color: "#6F7078", fontSize: 12 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#C4C3BB", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionText: { color: "#6F7078", fontSize: 12, fontWeight: "600" },
  error: { color: "#A3473F", marginTop: 30, textAlign: "center" },
  empty: { color: "#6F7078", fontSize: 13, textAlign: "center", padding: 20 },
});
