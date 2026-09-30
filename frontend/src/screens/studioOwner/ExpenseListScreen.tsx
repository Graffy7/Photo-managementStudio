import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { SearchInput } from "../../components/SearchInput";
import { expensesApi } from "../../api/expensesApi";
import { expenseCategoriesApi } from "../../api/expenseCategoriesApi";
import type { Expense } from "../../types/expense";
import { extractErrorMessage } from "../../api/errorMessage";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { DataList, CellMoney, CellSub, CellTitle, type Column } from "../../ui/DataList";
import { colors, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function details(e: Expense): string {
  return [e.paymentMethod, e.referenceNumber ? `Ref: ${e.referenceNumber}` : null, e.workerName, e.eventVenue].filter(Boolean).join(" · ");
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: categories } = useQuery({ queryKey: ["expense-categories"], queryFn: expenseCategoriesApi.getAll });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["expenses", search, categoryId, page],
    queryFn: () => expensesApi.search({ search: search || undefined, expenseCategoryId: categoryId ?? undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const remove = useMutation({
    mutationFn: expensesApi.remove,
    onSuccess: () => {
      setPendingDeleteId(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err) => setActionError(extractErrorMessage(err, "Couldn't delete this expense. Please try again.")),
  });

  // Delete asks once more in place: "Cancel / Delete" replaces the button until answered.
  const actions = (e: Expense) => {
    const confirming = pendingDeleteId === e.expenseId;
    const busy = remove.isPending && remove.variables === e.expenseId;
    return (
      <View style={styles.actionRow}>
        {confirming ? (
          <>
            <Button label="Cancel" variant="link" onPress={() => { setPendingDeleteId(null); setActionError(null); }} disabled={busy} />
            <Button label="Delete" variant="danger" loading={busy} onPress={() => remove.mutate(e.expenseId)} accessibilityLabel="Confirm delete expense" />
          </>
        ) : (
          <>
            <SubscriptionLock compact>
              <Button label="Edit" variant="link" onPress={() => onEdit(e)} />
            </SubscriptionLock>
            <Button label="Delete" variant="link" onPress={() => { setPendingDeleteId(e.expenseId); setActionError(null); }} />
          </>
        )}
      </View>
    );
  };

  const rowError = (e: Expense) =>
    pendingDeleteId === e.expenseId && actionError ? <Text style={styles.rowError}>{actionError}</Text> : null;

  const columns: Column<Expense>[] = [
    { key: "date", label: "Date", width: 130, render: (e) => <CellSub>{formatDate(e.expenseDate)}</CellSub> },
    { key: "category", label: "Category", flex: 1, render: (e) => <CellTitle>{e.expenseCategoryName}</CellTitle> },
    {
      key: "description", label: "Description", flex: 2,
      render: (e) => (<><CellTitle>{e.description || "—"}</CellTitle>{details(e) ? <CellSub>{details(e)}</CellSub> : null}{rowError(e)}</>),
    },
    { key: "amount", label: "Amount", width: 130, align: "right", render: (e) => <CellMoney>{formatCurrency(e.amount)}</CellMoney> },
    { key: "actions", label: "", width: 190, align: "right", render: actions },
  ];

  const filtered = !!search || categoryId !== null;

  return (
    <Screen>
      <PageHeader
        title="Expenses"
        subtitle={data ? `${data.totalCount} expense${data.totalCount === 1 ? "" : "s"}` : null}
        actions={
          <>
            <Button label="Categories" icon="pricetag-outline" onPress={onManageCategories} />
            <SubscriptionLock><Button label="New expense" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>
          </>
        }
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Search by description or reference number" />
      {categories && categories.length > 0 && (
        <View style={{ marginBottom: space.lg }}>
          <FilterChips<number | null>
            options={[{ value: null, label: "All" }, ...categories.map((c) => ({ value: c.expenseCategoryId, label: c.categoryName }))]}
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setPage(1); }}
          />
        </View>
      )}

      <DataList
        items={data?.items}
        keyOf={(e) => e.expenseId}
        columns={columns}
        onRowPress={onEdit}
        loading={isPending}
        error={isError ? "Couldn't load expenses. Check your connection and try again." : null}
        onRetry={() => refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No expenses match" text="Try a different word or category."
            action={<Button label="Clear filters" onPress={() => { setSearch(""); setCategoryId(null); setPage(1); }} />} />
        ) : (
          <EmptyState icon="receipt-outline" title="No expenses yet" text="Record what the studio spends — travel, equipment, albums, freelancers — to see your real profit."
            action={<Button label="New expense" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(e) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{e.description || e.expenseCategoryName}</Text>
              <Text style={styles.cardAmount}>{formatCurrency(e.amount)}</Text>
            </View>
            <Text style={styles.cardSub} numberOfLines={1}>{formatDate(e.expenseDate)} · {e.expenseCategoryName}</Text>
            {details(e) ? <Text style={styles.cardMeta} numberOfLines={1}>{details(e)}</Text> : null}
            {rowError(e)}
            <View style={styles.cardActions}>{actions(e)}</View>
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: space.xs },
  rowError: { ...type.caption, color: colors.danger, marginTop: 2 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardTitle: { ...type.heading, color: colors.text, flex: 1 },
  cardAmount: { ...type.heading, color: colors.text, fontVariant: ["tabular-nums"] },
  cardSub: { ...type.small, color: colors.textMuted },
  cardMeta: { ...type.caption, color: colors.textFaint },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.xs, marginHorizontal: -space.sm },
});
