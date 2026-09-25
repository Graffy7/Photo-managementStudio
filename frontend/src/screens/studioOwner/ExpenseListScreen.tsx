import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SearchInput } from "../../components/SearchInput";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "../../api/expensesApi";
import { expenseCategoriesApi } from "../../api/expenseCategoriesApi";
import type { Expense } from "../../types/expense";
import { extractErrorMessage } from "../../api/errorMessage";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ExpenseListScreen({
  onCreate,
  onEdit,
  onManageCategories,
}: {
  onCreate: () => void;
  onEdit: (expense: Expense) => void;
  onManageCategories: () => void;
}) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: categories } = useQuery({ queryKey: ["expense-categories"], queryFn: expenseCategoriesApi.getAll });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["expenses", search, categoryId],
    queryFn: () => expensesApi.search({ search: search || undefined, expenseCategoryId: categoryId ?? undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const remove = useMutation({
    mutationFn: expensesApi.remove,
    onSuccess: () => {
      setPendingDeleteId(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  const renderItem = ({ item }: { item: Expense }) => {
    const isPending = pendingDeleteId === item.expenseId;
    const isBusy = remove.isPending && remove.variables === item.expenseId;

    return (
      <View style={styles.row}>
        <Pressable style={styles.rowMain} onPress={() => onEdit(item)}>
          <Text style={styles.expenseDate}>{formatDate(item.expenseDate)} · {item.expenseCategoryName}</Text>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          <Text style={styles.meta}>
            {[item.paymentMethod, item.referenceNumber ? `Ref: ${item.referenceNumber}` : null].filter(Boolean).join(" · ")}
          </Text>
          {isPending && actionError && <Text style={styles.rowError}>{actionError}</Text>}
        </Pressable>

        {isPending ? (
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={() => { setPendingDeleteId(null); setActionError(null); }} disabled={isBusy}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => remove.mutate(item.expenseId)} disabled={isBusy}>
              {isBusy ? <ActivityIndicator color="#ff7a72" size="small" /> : <Text style={[styles.actionText, styles.actionTextDanger]}>Confirm</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.rowEnd}>
            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
            <Pressable style={styles.deleteLink} onPress={() => setPendingDeleteId(item.expenseId)}>
              <Text style={styles.deleteLinkText}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Expenses</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Pressable style={styles.categoriesButton} onPress={onManageCategories}>
            <Text style={styles.categoriesButtonText}>Categories</Text>
          </Pressable>
          <SubscriptionLock>
            <Pressable style={styles.newButton} onPress={onCreate}>
              <Text style={styles.newButtonText}>+ New Expense</Text>
            </Pressable>
          </SubscriptionLock>
        </View>
      </View>

      <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by description or reference number" />

      {categories && categories.length > 0 && (
        <View style={styles.filterRow}>
          <Pressable style={[styles.filterChip, categoryId === null && styles.filterChipSelected]} onPress={() => setCategoryId(null)}>
            <Text style={[styles.filterChipText, categoryId === null && styles.filterChipTextSelected]}>All</Text>
          </Pressable>
          {categories.map((c) => (
            <Pressable key={c.expenseCategoryId} style={[styles.filterChip, categoryId === c.expenseCategoryId && styles.filterChipSelected]} onPress={() => setCategoryId(c.expenseCategoryId)}>
              <Text style={[styles.filterChipText, categoryId === c.expenseCategoryId && styles.filterChipTextSelected]}>{c.categoryName}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load expenses.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.expenseId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No expenses yet — record the first one.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerActions: { flexDirection: "row", gap: 10 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  newButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  newButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  categoriesButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  categoriesButtonText: { color: "#a7b7cb", fontWeight: "600", fontSize: 13 },
  search: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: "#e8edf3", backgroundColor: "#132540", marginBottom: 12, fontSize: 14,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  filterChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#132540" },
  filterChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  filterChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  filterChipTextSelected: { color: "#ff9a4d" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  expenseDate: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  description: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  meta: { color: "#a7b7cb", fontSize: 12 },
  rowError: { color: "#ff7a72", fontSize: 12, marginTop: 4 },
  rowEnd: { alignItems: "flex-end", gap: 6 },
  amount: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  deleteLink: { paddingVertical: 2 },
  deleteLinkText: { color: "#ff7a72", fontSize: 11, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionBtnDanger: { borderColor: "rgba(255, 122, 114, 0.4)" },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  actionTextDanger: { color: "#ff7a72" },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
